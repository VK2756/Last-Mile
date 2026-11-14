// OWNER: Lane A. The tick loop. 1 tick = 1 simulated second. Deterministic by seed: the only randomness is
// pre-drawn in createFireModel / generatePopulation, so streamed and headless runs are identical.
import type {
  Assignment, DataSink, Dispatcher, FireModel, Helper, HelperState, Household, HouseholdState, HouseholdStatus, LatLng,
  Metrics, RoadGraph, Router, ScenarioConfig, SimFrame, SimInit, TriageResult, WorldSnapshot,
} from '@lastmile/contracts';
import { isVulnerable } from '@lastmile/contracts';
import { createFireModel, FIRE_ASSUMPTIONS } from './fire';
import { distMeters } from './geo';
import { loadGraph, makeDispatcher, makeRouter } from './deps';
import { generatePopulation, ALERT_ISSUE_S, type Behavior, type SafeZone } from '../world/population';
import { ALERTS_ONLY_ASSUMPTIONS, selfEvacDepartTime } from '../policy/alertsOnly';
import { helpRequestTime, LAST_MILE_ASSUMPTIONS } from '../policy/lastMile';

/** only households the fire reaches within this horizon are "at risk" and counted in Metrics */
export const HORIZON_S = 7200;
export const HARD_CAP_S = 4 * 3600;
export const ROAD_CONGESTION = 1.3;
export const PICKUP_RADIUS_M = 40;
const UNLOAD_RADIUS_M = 60;
const REPLAN_EVERY_S = 5;
const RISK_EVERY_S = 30;
const TTI_REPORT_MAX_S = 5400;

export interface SimOptions { graph?: RoadGraph; router?: Router; dispatcher?: Dispatcher; sink?: DataSink }

export type TriageOutcome =
  | { ok: true; status: HouseholdStatus; flipped: boolean }
  | { ok: false; code: 'unknown_household' | 'already_resolved' | 'already_leaving'; status?: HouseholdStatus };

export interface Sim {
  init: SimInit;
  readonly t: number;
  readonly done: boolean;
  /** advance by dt simulated seconds (fractions accumulate) and return the frame */
  step(dt: number): SimFrame;
  advance(ticks: number): void;
  frame(): SimFrame;
  finalMetrics(): Metrics;
  /** apply a voice-triage result to one household (see below); never throws */
  applyTriage(r: TriageResult): TriageOutcome;
  /** counters for tests */
  stats: { rejectedCapacity: number; rejectedWheelchair: number; plans: number };
}

interface HS {
  h: Household; b: Behavior; status: HouseholdStatus; ign: number; atRisk: boolean; vulnerable: boolean; zone: SafeZone;
  warnedAt: number; departAt: number; requestAt: number; nextTry: number; endAt: number; endStatus: HouseholdStatus; owner: number;
}
interface HP {
  h: Helper; pos: LatLng; status: HelperState['status']; asg: Assignment | null; targets: string[]; loaded: string[]; load: number;
  path: LatLng[]; pi: number; segLeft: number; segTotal: number; segFrom: LatLng;
}

const lerp = (a: LatLng, b: LatLng, f: number): LatLng => ({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f });

function pointAlong(route: LatLng[], f: number): LatLng {
  if (route.length < 2) return route[0]!;
  const seg: number[] = []; let total = 0;
  for (let i = 1; i < route.length; i++) { const d = distMeters(route[i - 1]!, route[i]!); seg.push(d); total += d; }
  let want = f * total;
  for (let i = 0; i < seg.length; i++) { if (want <= seg[i]! || i === seg.length - 1) return lerp(route[i]!, route[i + 1]!, seg[i]! > 0 ? Math.min(1, want / seg[i]!) : 1); want -= seg[i]!; }
  return route.at(-1)!;
}

export function createSim(config: ScenarioConfig, scenarioId: string, opts: SimOptions = {}): Sim {
  const graph = opts.graph ?? loadGraph(config);
  const fire: FireModel = createFireModel(config);
  const router = opts.router ?? makeRouter(graph, fire);
  const dispatcher = opts.dispatcher ?? makeDispatcher();
  const pop = generatePopulation(config, graph, fire);
  const lastMile = config.policy === 'last_mile';
  const sink = opts.sink;
  const swallow = (p: Promise<void>) => p.catch((e) => console.error('[sink]', e));

  const nearestZone = (p: LatLng): SafeZone => pop.safeZones.reduce((best, z) => (distMeters(p, z.position) < distMeters(p, best.position) ? z : best));
  const households: Household[] = pop.households.map((h) => ({ ...h, needs: [...h.needs] }));
  const hs: HS[] = households.map((h) => {
    const b = pop.behavior[h.id]!; const ign = fire.ignitionTime(h.position); const warnedAt = ALERT_ISSUE_S + b.alertDelayS;
    return {
      h, b, status: 'unaware', ign, atRisk: ign <= HORIZON_S, vulnerable: isVulnerable(h), zone: nearestZone(h.position), warnedAt,
      departAt: selfEvacDepartTime(h, b, warnedAt), requestAt: lastMile ? helpRequestTime(h, b, warnedAt) : Infinity,
      nextTry: 0, endAt: Infinity, endStatus: 'evacuated', owner: -1,
    };
  });
  const byId = new Map(hs.map((s) => [s.h.id, s]));
  const hp: HP[] = pop.helpers.map((h) => ({ h, pos: h.position, status: 'idle', asg: null, targets: [], loaded: [], load: 0, path: [], pi: 0, segLeft: -1, segTotal: 0, segFrom: h.position }));
  const hpById = new Map(hp.map((p, i) => [p.h.id, i]));

  let t = 0, acc = 0, dirty = false, lastPlan = -Infinity, outcomeSent = false, hardDone = false;
  const stats = { rejectedCapacity: 0, rejectedWheelchair: 0, plans: 0 };
  const atRiskCount = hs.filter((s) => s.atRisk).length;
  let unresolvedAtRisk = atRiskCount;

  const init: SimInit = {
    scenarioId, config, bounds: pop.bounds, households, helpers: pop.helpers, safeZones: pop.safeZones,
    assumptions: [
      ...pop.assumptions, ...FIRE_ASSUMPTIONS, ...ALERTS_ONLY_ASSUMPTIONS, ...(lastMile ? LAST_MILE_ASSUMPTIONS : []),
      `Metrics count only the ${atRiskCount} households the fire reaches within ${HORIZON_S / 3600} h. "Trapped" means the fire reached the household (or its vehicle) before it was safe; this is a simulation outcome, not a prediction of casualties.`,
      'Evacuating residents drive at road speed x1.3 congestion to the nearest safe zone and are trapped if the fire reaches any point of the route while they are on it.',
    ],
  };

  const resolve = (s: HS, status: 'evacuated' | 'trapped') => { if (s.status === 'evacuated' || s.status === 'trapped') return; s.status = status; s.owner = -1; if (s.atRisk) unresolvedAtRisk--; dirty = true; };
  const routeTo = (a: LatLng, b: LatLng): LatLng[] => { const r = router.route(a, b, t); return r.length >= 2 ? r : [a, b]; };

  function tryDepart(s: HS) {
    const dest = s.zone.position; const tt = router.travelSeconds(s.h.position, dest, t) * ROAD_CONGESTION;
    if (!Number.isFinite(tt)) { s.nextTry = t + 15; return; }
    const route = routeTo(s.h.position, dest);
    let caughtAt = Infinity;
    for (let k = 1; k <= 10; k++) { const f = k / 10; if (fire.isBurning(pointAlong(route, f), t + f * tt)) { caughtAt = t + f * tt; break; } }
    s.status = 'self_evacuating'; s.owner = -1; dirty = true;
    if (Number.isFinite(caughtAt)) { s.endAt = caughtAt; s.endStatus = 'trapped'; } else { s.endAt = t + tt; s.endStatus = 'evacuated'; }
  }

  function tickHouseholds() {
    for (const s of hs) {
      const st = s.status;
      if (st === 'evacuated' || st === 'trapped' || st === 'enroute') continue;
      if (st === 'self_evacuating') { if (t >= s.endAt) resolve(s, s.endStatus as 'evacuated' | 'trapped'); continue; }
      if (st === 'unaware' && t >= s.warnedAt) s.status = 'warned';
      if (s.ign <= t) { resolve(s, 'trapped'); continue; }
      if (s.status === 'warned' && t >= s.requestAt) { s.status = 'needs_help'; dirty = true; }
      if (t >= s.departAt && t >= s.nextTry && s.status !== 'unaware') tryDepart(s);
    }
  }

  function releaseTargets(p: HP, idx: number) {
    for (const id of p.targets) { const s = byId.get(id)!; if (s.status === 'assigned' && s.owner === idx) { s.status = 'needs_help'; s.owner = -1; } }
    p.targets = [];
  }

  function moveHelper(p: HP) {
    let budget = 1;
    while (budget > 0 && p.pi < p.path.length) {
      const nxt = p.path[p.pi]!;
      if (p.segLeft < 0) {
        const sec = router.travelSeconds(p.pos, nxt, t) * ROAD_CONGESTION;
        if (!Number.isFinite(sec)) return; // blocked: wait
        if (sec < 0.001) { p.pos = nxt; p.pi++; continue; }
        p.segLeft = sec; p.segTotal = sec; p.segFrom = p.pos;
      }
      if (p.segLeft <= budget) { budget -= p.segLeft; p.pos = nxt; p.pi++; p.segLeft = -1; }
      else { p.segLeft -= budget; budget = 0; p.pos = lerp(p.segFrom, nxt, 1 - p.segLeft / p.segTotal); }
    }
  }

  function tickHelper(p: HP, idx: number) {
    if (p.status === 'done') return;
    if (fire.isBurning(p.pos, t)) {
      for (const id of p.loaded) resolve(byId.get(id)!, 'trapped');
      releaseTargets(p, idx); p.loaded = []; p.load = 0; p.asg = null; p.status = 'done'; dirty = true; return;
    }
    if (!p.asg && !p.loaded.length) return;
    moveHelper(p);
    for (const id of [...p.targets]) {
      const s = byId.get(id)!;
      if (s.status !== 'assigned' || s.owner !== idx) { p.targets = p.targets.filter((x) => x !== id); continue; }
      if (distMeters(p.pos, s.h.position) <= PICKUP_RADIUS_M) {
        p.targets = p.targets.filter((x) => x !== id); p.loaded.push(id); p.load += s.h.residents; s.status = 'enroute'; dirty = true;
      }
    }
    if (p.pi >= p.path.length) {
      if (p.targets.length) {
        const next = byId.get(p.targets[0]!)!; p.path = routeTo(p.pos, next.h.position); p.pi = 0; p.segLeft = -1;
      } else if (p.loaded.length) {
        const z = nearestZone(p.pos);
        if (distMeters(p.pos, z.position) <= UNLOAD_RADIUS_M) {
          for (const id of p.loaded) resolve(byId.get(id)!, 'evacuated');
          p.loaded = []; p.load = 0; p.asg = null; p.path = []; p.pi = 0; dirty = true;
        } else { p.path = routeTo(p.pos, z.position); p.pi = 0; p.segLeft = -1; }
      } else { p.asg = null; p.path = []; p.pi = 0; dirty = true; }
    }
    p.status = p.loaded.length ? 'loaded' : p.asg ? 'enroute' : 'idle';
  }

  function snapshot(): WorldSnapshot {
    const householdStates: Record<string, HouseholdState> = {};
    for (const s of hs) householdStates[s.h.id] = { id: s.h.id, status: s.status, ttiSeconds: tti(s) };
    const helperStates: Record<string, HelperState> = {};
    for (const p of hp) helperStates[p.h.id] = helperState(p);
    return { t, config, households, householdStates, helpers: pop.helpers, helperStates, safeZones: pop.safeZones, fire, router };
  }

  function adopt(plan: Assignment[]) {
    const seen = new Set<string>();
    for (const a of plan) {
      const idx = hpById.get(a.helperId); if (idx === undefined || seen.has(a.helperId)) continue;
      const p = hp[idx]!; if (p.status === 'done') continue;
      const targets = a.householdIds.filter((id) => !p.loaded.includes(id)).filter((id) => { const s = byId.get(id); return !!s && (s.status === 'needs_help' || (s.status === 'assigned' && s.owner === idx)); });
      if (!targets.length) continue;
      const people = targets.reduce((n, id) => n + byId.get(id)!.h.residents, 0);
      if (p.load + people > p.h.capacity) { stats.rejectedCapacity++; continue; }
      if (!p.h.wheelchairCapable && targets.some((id) => byId.get(id)!.h.needs.includes('wheelchair'))) { stats.rejectedWheelchair++; continue; }
      seen.add(a.helperId);
      if (p.asg?.id === a.id && p.targets.length === targets.length && targets.every((id) => p.targets.includes(id))) continue;
      releaseTargets(p, idx);
      p.targets = targets;
      for (const id of targets) { const s = byId.get(id)!; s.status = 'assigned'; s.owner = idx; }
      p.asg = { ...a, householdIds: [...p.loaded, ...targets] };
      const route = a.route.length >= 2 ? a.route : routeTo(p.pos, byId.get(targets[0]!)!.h.position);
      p.path = route.filter((q, i) => !(i === 0 && distMeters(q, p.pos) < 5)); p.pi = 0; p.segLeft = -1;
      p.status = p.loaded.length ? 'loaded' : 'enroute';
      if (sink) swallow(sink.recordDispatch({ scenarioId, policy: config.policy, t, assignmentId: a.id, helperId: a.helperId, householdIds: targets, etaSeconds: a.etaSeconds, reason: a.reason }));
    }
    hp.forEach((p, idx) => {
      if (seen.has(p.h.id) || !p.targets.length) return;
      releaseTargets(p, idx);
      if (!p.loaded.length) { p.asg = null; p.path = []; p.pi = 0; p.status = p.status === 'done' ? 'done' : 'idle'; }
    });
  }

  function maybePlan() {
    if (!lastMile || !hp.length) return;
    if (!(dirty || t - lastPlan >= REPLAN_EVERY_S)) return;
    if (t - lastPlan < 1) return;
    if (!hs.some((s) => s.status === 'needs_help' || s.status === 'assigned')) { dirty = false; return; }
    lastPlan = t; dirty = false; stats.plans++;
    adopt(dispatcher.plan(snapshot()));
  }

  const tti = (s: HS): number | null => {
    if (s.status === 'evacuated' || s.status === 'trapped') return null;
    const r = s.ign - t; return Number.isFinite(r) && r > 0 && r <= TTI_REPORT_MAX_S ? Math.round(r) : null;
  };
  const helperState = (p: HP): HelperState => ({ id: p.h.id, position: p.pos, status: p.status, assignmentId: p.asg?.id ?? null, load: p.load });

  function metrics(): Metrics {
    let evacuated = 0, trapped = 0, inProgress = 0, vt = 0, ve = 0, vtr = 0;
    for (const s of hs) {
      if (!s.atRisk) continue;
      const e = s.status === 'evacuated', tr = s.status === 'trapped';
      if (e) evacuated++; else if (tr) trapped++; else inProgress++;
      if (s.vulnerable) { vt++; if (e) ve++; if (tr) vtr++; }
    }
    return { total: atRiskCount, evacuated, trapped, inProgress, vulnerableTotal: vt, vulnerableEvacuated: ve, vulnerableTrapped: vtr };
  }

  function tick() {
    t += 1;
    tickHouseholds();
    hp.forEach((p, i) => tickHelper(p, i));
    maybePlan();
    if (sink && t % RISK_EVERY_S === 0) {
      const samples = hs.filter((s) => s.atRisk && s.status !== 'evacuated' && s.status !== 'trapped').map((s) => ({ scenarioId, policy: config.policy, t, householdId: s.h.id, ttiSeconds: tti(s), status: s.status }));
      if (samples.length) swallow(sink.recordRisk(samples));
    }
    if (t >= HARD_CAP_S) hardDone = true;
    if (sink && !outcomeSent && (unresolvedAtRisk <= 0 || hardDone)) { outcomeSent = true; swallow(sink.recordOutcome({ scenarioId, policy: config.policy, seed: config.seed, metrics: metrics() })); }
  }

  function frame(): SimFrame {
    const assignments: Assignment[] = [];
    for (const p of hp) if (p.asg) assignments.push({ ...p.asg, route: [p.pos, ...p.path.slice(p.pi)] });
    return {
      scenarioId, policy: config.policy, t,
      fire: { rings: fire.rings(t), burnedFraction: fire.burnedFraction(t) },
      households: hs.map((s) => ({ id: s.h.id, status: s.status, ttiSeconds: tti(s) })),
      helpers: hp.map(helperState), assignments, metrics: metrics(),
    };
  }

  /**
   * A resident told the voice agent about their situation. Needs are merged (never removed). If they have no ride, cannot walk
   * to the road, or urgency >= 4, the household becomes `needs_help` right now (the call itself warns them) and, if it has no ride,
   * it stops counting on its own car. `Metrics.vulnerableTotal` keeps the ORIGINAL definition so outcomes stay comparable.
   */
  function applyTriage(r: TriageResult): TriageOutcome {
    const s = byId.get(r.householdId);
    if (!s) return { ok: false, code: 'unknown_household' };
    if (s.status === 'evacuated' || s.status === 'trapped') return { ok: false, code: 'already_resolved', status: s.status };
    if (s.status === 'self_evacuating' || s.status === 'enroute') return { ok: false, code: 'already_leaving', status: s.status };
    for (const n of r.needs) if (!s.h.needs.includes(n)) s.h.needs.push(n);
    if (r.residents !== null) s.h.residents = Math.max(1, Math.min(12, r.residents));
    const noRide = r.hasRide === false;
    if (noRide && s.h.hasVehicle) {
      s.h.hasVehicle = false; if (!s.h.needs.includes('no_vehicle')) s.h.needs.push('no_vehicle');
      s.departAt = s.b.familyPickup ? s.warnedAt + s.b.pickupDelayS : Infinity;
    }
    const flip = noRide || r.canWalkToRoad === false || r.urgency >= 4 || !s.h.hasVehicle;
    if (flip && (s.status === 'unaware' || s.status === 'warned')) { s.status = 'needs_help'; s.warnedAt = Math.min(s.warnedAt, t); dirty = true; }
    return { ok: true, status: s.status, flipped: flip };
  }

  const advance = (n: number) => { for (let i = 0; i < n && !isDone(); i++) tick(); };
  const isDone = () => unresolvedAtRisk <= 0 || hardDone;

  return {
    init, stats, frame, advance, applyTriage, finalMetrics: metrics,
    get t() { return t; }, get done() { return isDone(); },
    step(dt) { acc += dt; const n = Math.floor(acc); acc -= n; advance(n); return frame(); },
  };
}
