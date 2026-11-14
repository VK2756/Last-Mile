// MOCK MODE (?mock=1). Owner: Lane B.
// A small deterministic browser-side stand-in for the engine so the UI never blocks on it and
// the demo survives a dead network. It is NOT the engine and its numbers are NOT results:
// the UI labels it "mock data", and headline numbers only ever come from /results (Monte Carlo).
//
// It starts from the contract fixtures (sampleInit / sampleFrame) and adds a seeded synthetic
// neighbourhood so the map has something to show. Same seed => same run, for both policies, so the
// split screen stays in sync.
import {
  isVulnerable,
  type Assignment,
  type Helper,
  type HelperState,
  type Household,
  type HouseholdState,
  type HouseholdStatus,
  type LatLng,
  type LngLat,
  type Metrics,
  type ScenarioConfig,
  type SimFrame,
  type SimInit,
} from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';

export const MOCK_DURATION_S = 2400;
const MOCK_HOUSEHOLDS = 140;
const ALERT_AT_S = 90;
const HELPER_SPEED_MPS = 11; // ~25 mph on local roads
const DETOUR = 1.35; // straight line -> road distance
const LOAD_S = 150; // time to get a wheelchair user / oxygen into a vehicle
const THREAT_HORIZON_S = 45 * 60;

// ---------- seeded RNG ----------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- local metric projection ----------
const M_PER_DEG_LAT = 110_540;
interface Proj { toXY(p: LatLng): [number, number]; toLatLng(x: number, y: number): LatLng }
function projection(origin: LatLng): Proj {
  const mLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    toXY: (p) => [(p.lng - origin.lng) * mLng, (p.lat - origin.lat) * M_PER_DEG_LAT],
    toLatLng: (x, y) => ({ lat: origin.lat + y / M_PER_DEG_LAT, lng: origin.lng + x / mLng }),
  };
}
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------- fire model (mock): wind-stretched ellipse, homogeneous in time ----------
// Arrival time T(p) is degree-1 homogeneous in p (relative to ignition), so the front at time t is
// simply { p : T(p) = t } and each household's arrival time is computed once.
interface FireShape { arrival(x: number, y: number): number; frontRadius(theta: number, t: number): number }
function fireShape(config: ScenarioConfig, rnd: () => number): FireShape {
  const wind = config.wind.speedMph;
  const base = 0.55; // m/s with no wind
  const head = base * (1 + wind / 9);
  const back = base * 0.35;
  const flank = base * (0.75 + wind / 60);
  const a = (head + back) / 2; // semi-major axis per second
  const c = (head - back) / 2; // centre drift per second (downwind)
  const b = flank;
  // dirDeg = direction the wind blows FROM (meteorological); fire is pushed the opposite way.
  const toward = ((config.wind.dirDeg + 180) % 360) * (Math.PI / 180);
  const ux = Math.sin(toward); // compass bearing -> x east
  const uy = Math.cos(toward); // -> y north
  const h1 = rnd() * Math.PI * 2, h2 = rnd() * Math.PI * 2, h3 = rnd() * Math.PI * 2;
  const wobble = (th: number) => 1 + 0.1 * Math.sin(3 * th + h1) + 0.06 * Math.sin(5 * th + h2) + 0.04 * Math.sin(8 * th + h3);
  /** time for the unwobbled ellipse to reach (x,y) */
  const gauge = (x: number, y: number) => {
    const xr = x * ux + y * uy; // along wind
    const yr = -x * uy + y * ux; // across wind
    const A = (xr * xr) / (a * a) + (yr * yr) / (b * b);
    const B = (-2 * xr * c) / (a * a);
    const C = (c * c) / (a * a) - 1; // < 0 because c < a
    if (A === 0) return 0;
    const u = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A); // 1/t, positive root
    return 1 / u;
  };
  return {
    arrival: (x, y) => gauge(x, y) * wobble(Math.atan2(y, x)),
    frontRadius: (th, t) => t / (gauge(Math.cos(th), Math.sin(th)) * wobble(th)),
  };
}

// ---------- per-household script ----------
interface HhSim {
  h: Household;
  xy: [number, number];
  arrival: number; // fire arrival, sim seconds
  vulnerable: boolean;
  noticeAt: number; // when they learn of the fire (alerts)
  callAt: number; // last_mile: when the AI call reaches them
  selfLeaveAt: number; // when they'd have left on their own (Infinity if they can't)
  selfDoneAt: number;
  familyRescueAt: number; // alerts_only baseline: family/neighbour picks them up (Infinity = nobody)
  status: HouseholdStatus;
}

interface HelperSim {
  helper: Helper;
  xy: [number, number];
  state: HelperState['status'];
  target: HhSim | null;
  assignment: Assignment | null;
  legs: Array<[number, number]>; // remaining waypoints
  loadUntil: number;
  load: number;
}

export interface MockRunner {
  init: SimInit;
  readonly done: boolean;
  readonly t: number;
  step(dt: number): SimFrame;
  frame(): SimFrame;
  finalMetrics(): Metrics;
}

const HELPER_KIND_LABEL: Record<Helper['kind'], string> = {
  neighbor: 'Neighbour with car',
  volunteer: 'Volunteer driver',
  accessible_van: 'Wheelchair-capable van',
  shuttle_bus: 'Shuttle bus',
};

function buildWorld(config: ScenarioConfig) {
  const rnd = mulberry32(config.seed * 9973 + 17);
  const { sw, ne } = sampleInit.bounds;
  const origin = config.ignition;
  const proj = projection(origin);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // Neighbourhood centres; households cluster along "streets" around them.
  const hoods = Array.from({ length: 6 }, () => ({ lat: lerp(sw.lat, ne.lat, 0.12 + rnd() * 0.76), lng: lerp(sw.lng, ne.lng, 0.1 + rnd() * 0.8) }));
  const NEEDS_POOL: Household['needs'][] = [
    ['no_vehicle'], ['wheelchair', 'no_vehicle'], ['oxygen'], ['dementia'], ['medical_device'], ['vision_impaired'],
    ['limited_english'], ['young_children'], ['pets'], ['hearing_impaired'], ['no_cell_signal'],
  ];
  const LANGS = ['en', 'en', 'en', 'en', 'es', 'es', 'pt', 'zh', 'vi'];
  const households: Household[] = sampleInit.households.map((h) => ({ ...h }));
  for (let i = 0; i < MOCK_HOUSEHOLDS; i++) {
    const hood = hoods[i % hoods.length]!;
    const horiz = rnd() < 0.5;
    const along = (rnd() - 0.5) * 0.012;
    const across = Math.round((rnd() - 0.5) * 4) * 0.0018 + (rnd() - 0.5) * 0.0003;
    const lat = Math.min(ne.lat, Math.max(sw.lat, hood.lat + (horiz ? across : along * 0.75)));
    const lng = Math.min(ne.lng, Math.max(sw.lng, hood.lng + (horiz ? along : across * 1.35)));
    const r = rnd();
    const needs = r < 0.3 ? [...NEEDS_POOL[Math.floor(rnd() * NEEDS_POOL.length)]!] : [];
    const hasVehicle = !needs.includes('no_vehicle') && rnd() > 0.06;
    households.push({
      id: `m${i + 1}`,
      position: { lat, lng },
      residents: 1 + Math.floor(rnd() * 4),
      language: LANGS[Math.floor(rnd() * LANGS.length)]!,
      needs,
      hasVehicle,
      landlineOnly: rnd() < (needs.length ? 0.35 : 0.05),
    });
  }

  const KINDS: Helper['kind'][] = ['neighbor', 'neighbor', 'volunteer', 'volunteer', 'accessible_van', 'shuttle_bus'];
  const helpers: Helper[] = sampleInit.helpers.map((p) => ({ ...p }));
  const helperTotal = Math.max(helpers.length, config.helperCount);
  for (let i = helpers.length; i < helperTotal; i++) {
    const kind = KINDS[Math.floor(rnd() * KINDS.length)]!;
    helpers.push({
      id: `p${i + 1}`,
      kind,
      position: { lat: lerp(sw.lat, ne.lat, rnd()), lng: lerp(sw.lng, ne.lng, rnd()) },
      capacity: kind === 'shuttle_bus' ? 20 : kind === 'accessible_van' ? 4 : 3,
      wheelchairCapable: kind === 'accessible_van' || kind === 'shuttle_bus',
    });
  }

  const safeZones = [
    ...sampleInit.safeZones,
    { id: 'z2', name: 'North shelter (mock)', position: { lat: lerp(sw.lat, ne.lat, 0.94), lng: lerp(sw.lng, ne.lng, 0.2) } },
    { id: 'z3', name: 'East shelter (mock)', position: { lat: lerp(sw.lat, ne.lat, 0.55), lng: lerp(sw.lng, ne.lng, 0.97) } },
  ];

  const fire = fireShape(config, rnd);
  const hh: HhSim[] = households.map((h) => {
    const xy = proj.toXY(h.position);
    const arrival = fire.arrival(xy[0], xy[1]);
    const vulnerable = isVulnerable(h);
    const getsAlert = !h.landlineOnly ? rnd() > 0.12 : rnd() > 0.55; // landline-only homes often miss app/cell alerts
    const noticeAt = getsAlert ? ALERT_AT_S + rnd() * 240 : Math.max(ALERT_AT_S, arrival - 200 - rnd() * 200); // late: they see smoke
    const callAt = ALERT_AT_S + 30 + rnd() * 300; // Last Mile phones everyone flagged at-risk, landlines included
    const leaveDelay = h.needs.includes('young_children') || h.needs.includes('pets') ? 420 + rnd() * 600 : 180 + rnd() * 540;
    const selfLeaveAt = !vulnerable && h.hasVehicle ? noticeAt + leaveDelay : Infinity;
    const familyRescueAt = vulnerable && rnd() < 0.3 ? noticeAt + 600 + rnd() * 900 : Infinity;
    return { h, xy, arrival, vulnerable, noticeAt, callAt, selfLeaveAt, selfDoneAt: selfLeaveAt + 240, familyRescueAt, status: 'unaware' };
  });
  const hs: HelperSim[] = helpers.map((helper) => ({
    helper, xy: proj.toXY(helper.position), state: 'idle', target: null, assignment: null, legs: [], loadUntil: 0, load: 0,
  }));
  return { households, helpers, safeZones, hh, hs, fire, proj };
}

export function createMockRunner(scenarioId: string, config: ScenarioConfig, duration = MOCK_DURATION_S): MockRunner {
  const w = buildWorld(config);
  const zonesXY = w.safeZones.map((z) => ({ z, xy: w.proj.toXY(z.position) }));
  const init: SimInit = {
    scenarioId,
    config,
    bounds: sampleInit.bounds,
    households: w.households,
    helpers: w.helpers,
    safeZones: w.safeZones,
    assumptions: [
      'MOCK MODE: a scripted browser-side animation, not the Last Mile engine. Numbers here are illustrative only.',
      'SYNTHETIC residents and helpers; not real people.',
      ...sampleInit.assumptions.filter((a) => !a.startsWith('SYNTHETIC')),
      `Mock fire: wind-stretched ellipse from the ignition point; ${config.wind.speedMph} mph wind from ${config.wind.dirDeg}°.`,
      'Mock alerts at T+1:30; ~12% of households (more for landline-only homes) never receive them and react only to smoke.',
      `Mock helpers drive ${HELPER_SPEED_MPS} m/s along straight lines × ${DETOUR} detour, one household per trip.`,
    ],
  };
  let t = 0;
  let nextAssign = 1;
  const nearestZone = (xy: [number, number]) => zonesXY.reduce((best, z) => (dist(z.xy, xy) < dist(best.xy, xy) ? z : best));
  const assigned = new Set<HhSim>();

  const terminal = (s: HouseholdStatus) => s === 'evacuated' || s === 'trapped';

  function advanceHouseholds() {
    for (const s of w.hh) {
      if (terminal(s.status)) continue;
      const rescued = s.status === 'enroute';
      if (!rescued && t >= s.arrival) { s.status = 'trapped'; continue; }
      if (rescued) continue; // helper owns this household now
      if (s.status === 'self_evacuating') { if (t >= s.selfDoneAt) s.status = 'evacuated'; continue; }
      if (t >= s.selfLeaveAt && s.selfLeaveAt < s.arrival - 60) { s.status = 'self_evacuating'; continue; }
      if (config.policy === 'alerts_only' && t >= s.familyRescueAt && s.familyRescueAt < s.arrival - 120) { s.status = 'evacuated'; continue; }
      const aware = t >= s.noticeAt || (config.policy === 'last_mile' && s.vulnerable && t >= s.callAt);
      if (s.status === 'assigned') continue;
      if (aware) s.status = s.vulnerable ? 'needs_help' : s.status === 'unaware' ? 'warned' : s.status;
    }
  }

  function dispatch() {
    if (config.policy !== 'last_mile') return;
    const waiting = w.hh
      .filter((s) => s.status === 'needs_help' && !assigned.has(s) && s.arrival > t)
      .sort((a, b) => a.arrival - b.arrival);
    for (const s of waiting) {
      const needsChair = s.h.needs.includes('wheelchair');
      let best: { hp: HelperSim; eta: number } | null = null;
      for (const hp of w.hs) {
        if (hp.state !== 'idle' && hp.state !== 'done') continue;
        if (needsChair && !hp.helper.wheelchairCapable) continue;
        const eta = (dist(hp.xy, s.xy) * DETOUR) / HELPER_SPEED_MPS;
        if (!best || eta < best.eta) best = { hp, eta };
      }
      if (!best) continue;
      const tti = s.arrival - t;
      if (best.eta + LOAD_S > tti) continue; // can't make it; leave for a closer helper next tick
      const zone = nearestZone(s.xy);
      const slack = tti - best.eta;
      const kind = HELPER_KIND_LABEL[best.hp.helper.kind];
      const a: Assignment = {
        id: `a${nextAssign++}`,
        helperId: best.hp.helper.id,
        householdIds: [s.h.id],
        route: [w.proj.toLatLng(...best.hp.xy), s.h.position, zone.z.position],
        etaSeconds: Math.round(best.eta),
        deadlineSeconds: Math.round(tti),
        reason: `${kind}, ${(best.eta / 60).toFixed(1)} min away; arrives ${(slack / 60).toFixed(1)} min before the fire${needsChair ? '; wheelchair-capable' : ''}. Most urgent household still waiting.`,
      };
      best.hp.state = 'enroute';
      best.hp.target = s;
      best.hp.assignment = a;
      best.hp.legs = [s.xy, zone.xy];
      assigned.add(s);
      s.status = 'assigned';
    }
  }

  function moveHelpers(dt: number) {
    for (const hp of w.hs) {
      if (hp.state === 'idle' || hp.state === 'done' || !hp.target) continue;
      const s = hp.target;
      if (hp.state === 'enroute' && s.status === 'trapped') {
        hp.state = 'idle'; hp.target = null; hp.assignment = null; hp.legs = []; continue;
      }
      if (hp.loadUntil > t) continue;
      let budget = HELPER_SPEED_MPS * dt / DETOUR;
      while (budget > 0 && hp.legs.length) {
        const goal = hp.legs[0]!;
        const d = dist(hp.xy, goal);
        if (d <= budget) {
          hp.xy = [goal[0], goal[1]];
          budget -= d;
          hp.legs.shift();
          if (hp.state === 'enroute') { // reached the household
            hp.state = 'loaded'; hp.load = s.h.residents; s.status = 'enroute'; hp.loadUntil = t + LOAD_S; budget = 0;
          } else { // reached the safe zone
            s.status = 'evacuated'; hp.state = 'idle'; hp.load = 0; hp.target = null; hp.assignment = null; assigned.delete(s);
          }
        } else {
          hp.xy = [hp.xy[0] + ((goal[0] - hp.xy[0]) * budget) / d, hp.xy[1] + ((goal[1] - hp.xy[1]) * budget) / d];
          budget = 0;
        }
      }
      if (hp.assignment) {
        hp.assignment = { ...hp.assignment, route: [w.proj.toLatLng(...hp.xy), ...hp.legs.map((p) => w.proj.toLatLng(...p))] };
        if (hp.assignment.route.length < 2) hp.assignment.route.push(hp.assignment.route[0]!);
      }
    }
  }

  function metrics(): Metrics {
    let evacuated = 0, trapped = 0, inProgress = 0, vulnerableTotal = 0, vulnerableEvacuated = 0, vulnerableTrapped = 0;
    for (const s of w.hh) {
      if (s.vulnerable) vulnerableTotal++;
      if (s.status === 'evacuated') { evacuated++; if (s.vulnerable) vulnerableEvacuated++; }
      else if (s.status === 'trapped') { trapped++; if (s.vulnerable) vulnerableTrapped++; }
      else if (s.status !== 'unaware') inProgress++;
    }
    return { total: w.hh.length, evacuated, trapped, inProgress, vulnerableTotal, vulnerableEvacuated, vulnerableTrapped };
  }

  function fireRings(): LngLat[][] {
    if (t <= 0) return [];
    const N = 72;
    const ring: LngLat[] = [];
    for (let i = 0; i <= N; i++) {
      const th = ((i % N) / N) * Math.PI * 2;
      const r = w.fire.frontRadius(th, t);
      const p = w.proj.toLatLng(Math.cos(th) * r, Math.sin(th) * r);
      ring.push([p.lng, p.lat]);
    }
    return [ring];
  }

  function frame(): SimFrame {
    const { sw, ne } = init.bounds;
    const boundsArea = dist(w.proj.toXY(sw), w.proj.toXY({ lat: sw.lat, lng: ne.lng })) * dist(w.proj.toXY(sw), w.proj.toXY({ lat: ne.lat, lng: sw.lng }));
    let fireArea = 0; // polar area of the front
    const N = 72;
    for (let i = 0; i < N; i++) { const r = w.fire.frontRadius((i / N) * Math.PI * 2, t); fireArea += 0.5 * r * r * ((2 * Math.PI) / N); }
    const households: HouseholdState[] = w.hh.map((s) => {
      const left = s.arrival - t;
      return { id: s.h.id, status: s.status, ttiSeconds: terminal(s.status) || left > THREAT_HORIZON_S ? null : Math.max(0, Math.round(left)) };
    });
    const helpers: HelperState[] = w.hs.map((hp) => ({
      id: hp.helper.id, position: w.proj.toLatLng(...hp.xy), status: hp.state, assignmentId: hp.assignment?.id ?? null, load: hp.load,
    }));
    return {
      scenarioId,
      policy: config.policy,
      t,
      fire: { rings: fireRings(), burnedFraction: Math.min(1, fireArea / boundsArea) },
      households,
      helpers,
      assignments: w.hs.flatMap((hp) => (hp.assignment ? [hp.assignment] : [])),
      metrics: metrics(),
    };
  }

  const runner: MockRunner = {
    init,
    get t() { return t; },
    get done() { return t >= duration || w.hh.every((s) => terminal(s.status) || s.arrival > duration); },
    step(dt: number) {
      // sub-step so fast playback stays stable
      const sub = Math.max(1, Math.ceil(dt / 5));
      for (let i = 0; i < sub && t < duration; i++) {
        const d = Math.min(dt / sub, duration - t);
        t += d;
        advanceHouseholds();
        dispatch();
        moveHelpers(d);
      }
      return frame();
    },
    frame,
    finalMetrics: metrics,
  };
  return runner;
}
