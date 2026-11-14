// OWNER: Lane D (dispatch). Greedy insertion + local search for evacuation pickups.
//
// Who is planned: households whose status is `needs_help`, plus `assigned` ones (which may only stay with
// the helper they are assigned to). Every helper except `done` is planned; a `loaded` one counts the people
// already on board against its capacity. plan() returns the COMPLETE plan: a helper missing from it is idle.
// Each household's deadline is `ttiSeconds - safetyMarginSeconds` (relative to now). A helper's trip is
// start -> pickup 1 -> ... -> pickup k -> nearest safe zone. Rules, all hard constraints:
//   - total residents on a trip <= helper.capacity
//   - a household needing a wheelchair is only served by a wheelchairCapable helper
//   - every pickup is reached by its deadline (boarding time counted between stops)
// Households no trip can serve are FLAGGED (see `lastUnservable()`), never silently dropped. If a
// flagged household can still be reached before the fire itself arrives (ignoring the safety margin),
// an idle helper is sent on a clearly labelled best-effort trip.
//
// Algorithm, deterministic for identical input:
//   1. Pin: a helper already `enroute` keeps its current first pickup while that is still feasible.
//   2. Greedy insertion in deadline order: each household goes to the (helper, position) with the
//      smallest increase in that helper's trip completion time. Stops after the first must be within
//      `pairingRadiusMeters` of a neighbouring stop; that leg is estimated during search.
//   3. Local search: relocate single pickups between helpers while the total completion time drops,
//      then retry flagged households in the freed capacity.
//   4. Verify every trip with exact router times; a trip that misses a deadline is cut at that stop
//      and the removed households are retried as single pickups (exact), else flagged.
import type { Assignment, Dispatcher, Helper, Household, LatLng, WorldSnapshot } from '@lastmile/contracts';

export interface DispatchOptions {
  /** deadline = ttiSeconds - safetyMarginSeconds. Default 120. */
  safetyMarginSeconds?: number;
  /** Time spent at each pickup. Default 90 s; wheelchair households default 240 s. */
  boardingSeconds?: number;
  wheelchairBoardingSeconds?: number;
  /** Deadline used for households the fire is not currently projected to reach. Default 3 h. */
  unthreatenedDeadlineSeconds?: number;
  /** A second pickup must be within this straight-line distance of a neighbouring stop. Default 400 m. */
  pairingRadiusMeters?: number;
  /** Search-time estimate for pickup-to-pickup legs: straight line x detourFactor at estimateSpeedMph. */
  detourFactor?: number;
  estimateSpeedMph?: number;
  /** Max relocate passes in local search. Default 3. */
  localSearchPasses?: number;
}

export interface Unservable {
  householdId: string;
  /** one plain sentence, safe to show in the UI */
  reason: string;
  /** true if a best-effort trip (past the safety deadline, before the fire) was still sent */
  bestEffort: boolean;
}

export interface DispatchPlanner extends Dispatcher {
  /** Households the last plan could not serve within their deadline. */
  lastUnservable(): Unservable[];
}

type Resolved = Required<DispatchOptions>;
const DEFAULTS: Resolved = {
  safetyMarginSeconds: 120,
  boardingSeconds: 90,
  wheelchairBoardingSeconds: 240,
  unthreatenedDeadlineSeconds: 3 * 3600,
  pairingRadiusMeters: 400,
  detourFactor: 1.3,
  estimateSpeedMph: 25,
  localSearchPasses: 3,
};

/** Plain-English description of the dispatch rules, for SimInit.assumptions. */
export function dispatchAssumptions(opts: DispatchOptions = {}): string[] {
  const o = { ...DEFAULTS, ...opts };
  return [
    `Dispatch: a helper must reach each home at least ${Math.round(o.safetyMarginSeconds / 60)} min before the fire is projected to arrive; otherwise the home is flagged as unservable.`,
    `Dispatch: boarding takes ${Math.round(o.boardingSeconds / 60 * 10) / 10} min per home (${Math.round(o.wheelchairBoardingSeconds / 60)} min with a wheelchair); helpers never exceed their seat capacity and only wheelchair-capable vehicles take wheelchair users.`,
    `Dispatch: one helper may combine homes within ${o.pairingRadiusMeters} m of each other on a single trip, then drives to the nearest safe zone.`,
  ];
}

const M_PER_DEG = 111_320;
const straightMeters = (a: LatLng, b: LatLng) =>
  Math.hypot((a.lat - b.lat) * M_PER_DEG, (a.lng - b.lng) * M_PER_DEG * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180));
const minutes = (s: number) => `${(Math.max(0, s) / 60).toFixed(1)} min`;
const KIND_LABEL: Record<Helper['kind'], string> = {
  neighbor: 'Neighbor',
  volunteer: 'Volunteer driver',
  accessible_van: 'Accessible van',
  shuttle_bus: 'Shuttle bus',
};

interface Req {
  h: Household;
  /** seconds from now */
  deadline: number;
  /** seconds until the fire itself arrives (no margin); Infinity if not threatened */
  fireIn: number;
  wheelchair: boolean;
  board: number;
  /** nearest safe zone by travel time, and the time to get there */
  zone: number;
  toZone: number;
  /** van index this home must stay with (it is already `assigned` to that helper), or -1 */
  owner: number;
}

interface Van {
  helper: Helper;
  pos: LatLng;
  /** request index pinned as first pickup, or -1 */
  pinned: number;
  /** household id an enroute helper is heading to (from our last plan) */
  firstPick: string | undefined;
  seq: number[];
  /** people already on board (a `loaded` helper can still take more) */
  base: number;
  /** base + residents of every home in seq */
  people: number;
  completion: number;
}

export function createDispatcher(options: DispatchOptions = {}): DispatchPlanner {
  const o: Resolved = { ...DEFAULTS, ...options };
  const estMps = o.estimateSpeedMph * 0.44704;
  /** our last plan: assignmentId -> household ids, so an enroute helper's commitment can be recognised */
  let memory = new Map<string, string[]>();
  /** stable ids: same helper + same first pickup keeps the same assignment id across re-plans */
  const ids = new Map<string, string>();
  let nextId = 1;
  let unservable: Unservable[] = [];

  const plan = (world: WorldSnapshot): Assignment[] => {
    const { t, router } = world;

    // ---- helpers ----
    const vans: Van[] = [];
    const vanOf = new Map<string, number>(); // helperId -> van index
    const ownerOf = new Map<string, string>(); // householdId -> helperId it is currently assigned to (from our last plan)
    const helpers = [...world.helpers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const helper of helpers) {
      const st = world.helperStates[helper.id];
      const status = st?.status ?? 'idle';
      const committed = st?.assignmentId ? memory.get(st.assignmentId) : undefined;
      if (committed) for (const hid of committed) ownerOf.set(hid, helper.id);
      if (status === 'done') continue;
      const base = status === 'loaded' ? (st?.load ?? 0) : 0;
      if (base >= helper.capacity) continue;
      vanOf.set(helper.id, vans.length);
      vans.push({ helper, pos: st?.position ?? helper.position, pinned: -1, firstPick: status === 'enroute' ? committed?.[0] : undefined, seq: [], base, people: base, completion: 0 });
    }
    const H = vans.length;

    // ---- requests ----
    // `assigned` homes may only stay with the helper they are assigned to (the engine rejects moving
    // them); if that helper is not plannable we leave them alone this round.
    const reqs: Req[] = [];
    for (const h of world.households) {
      const s = world.householdStates[h.id];
      if (!s || (s.status !== 'needs_help' && s.status !== 'assigned')) continue;
      let owner = -1;
      if (s.status === 'assigned') {
        const helperId = ownerOf.get(h.id);
        const v = helperId === undefined ? undefined : vanOf.get(helperId);
        if (v === undefined) continue;
        owner = v;
      }
      const tti = s.ttiSeconds;
      const wheelchair = h.needs.includes('wheelchair');
      reqs.push({
        h,
        deadline: tti === null ? o.unthreatenedDeadlineSeconds : tti - o.safetyMarginSeconds,
        fireIn: tti === null ? Infinity : tti,
        wheelchair,
        board: wheelchair ? o.wheelchairBoardingSeconds : o.boardingSeconds,
        zone: -1,
        toZone: Infinity,
        owner,
      });
    }
    reqs.sort((a, b) => a.deadline - b.deadline || (a.h.id < b.h.id ? -1 : a.h.id > b.h.id ? 1 : 0));
    const reqIdx = new Map(reqs.map((r, i) => [r.h.id, i] as const));
    const R = reqs.length;
    for (const r of reqs) {
      world.safeZones.forEach((z, zi) => {
        const s = router.travelSeconds(r.h.position, z.position, t);
        if (s < r.toZone) { r.toZone = s; r.zone = zi; }
      });
    }
    // an enroute helper keeps its current first pickup (if that home still needs it)
    for (const van of vans) {
      const ri = van.firstPick === undefined ? undefined : reqIdx.get(van.firstPick);
      if (ri !== undefined && reqs[ri]!.owner === vanOf.get(van.helper.id)) van.pinned = ri;
    }

    // ---- travel: helper -> household is exact (router); household -> household is estimated in search ----
    // If the router offers a guaranteed lower bound and even that misses the home's deadline, the exact
    // time cannot make it either: store the bound (still > deadline, so every feasibility test gives the
    // same answer) and skip the query. `exactDH` resolves it where the true value matters.
    const dH = new Float64Array(H * R);
    const pruned = new Uint8Array(H * R);
    const lb = 'lowerBoundSeconds' in router && typeof router.lowerBoundSeconds === 'function'
      ? (router.lowerBoundSeconds as (a: LatLng, b: LatLng) => number).bind(router)
      : null;
    for (let v = 0; v < H; v++) {
      for (let r = 0; r < R; r++) {
        const k = v * R + r;
        if (lb) {
          const bound = lb(vans[v]!.pos, reqs[r]!.h.position);
          if (bound > reqs[r]!.deadline) { dH[k] = bound; pruned[k] = 1; continue; }
        }
        dH[k] = router.travelSeconds(vans[v]!.pos, reqs[r]!.h.position, t);
      }
    }
    const exactDH = (v: number, r: number): number => {
      const k = v * R + r;
      if (pruned[k]) { dH[k] = router.travelSeconds(vans[v]!.pos, reqs[r]!.h.position, t); pruned[k] = 0; }
      return dH[k]!;
    };
    const est = (a: number, b: number) => {
      const m = straightMeters(reqs[a]!.h.position, reqs[b]!.h.position);
      return m > o.pairingRadiusMeters ? Infinity : (m * o.detourFactor) / estMps;
    };
    const exactMemo = new Map<number, number>();
    const exact = (a: number, b: number) => {
      const k = a * R + b;
      let v = exactMemo.get(k);
      if (v === undefined) { v = router.travelSeconds(reqs[a]!.h.position, reqs[b]!.h.position, t); exactMemo.set(k, v); }
      return v;
    };
    const compatible = (van: Van, r: Req) =>
      !(r.wheelchair && !van.helper.wheelchairCapable) &&
      van.base + r.h.residents <= van.helper.capacity &&
      (r.owner < 0 || vans[r.owner] === van);

    /** completion time of trip `seq` for van `v`, or Infinity if any rule is broken */
    /**
     * Completion time of trip `seq` for van `v` (with `ins` virtually inserted at index `at`, if given),
     * or Infinity if any rule is broken. Allocation-free: this is the dispatcher's hot loop.
     */
    const evaluate = (v: number, seq: number[], leg: (a: number, b: number) => number, at = -1, ins = -1): number => {
      const van = vans[v]!;
      const n = seq.length + (at >= 0 ? 1 : 0);
      if (n === 0) return 0;
      let time = 0, people = van.base, prev = -1;
      for (let i = 0; i < n; i++) {
        const ri = at < 0 || i < at ? seq[i]! : i === at ? ins : seq[i - 1]!;
        if (i === 0 && van.pinned >= 0 && ri !== van.pinned) return Infinity;
        const r = reqs[ri]!;
        people += r.h.residents;
        if (people > van.helper.capacity || !compatible(van, r)) return Infinity;
        const arrive = time + (i === 0 ? dH[v * R + ri]! : leg(prev, ri));
        if (!(arrive <= r.deadline)) return Infinity;
        time = arrive + r.board;
        prev = ri;
      }
      return time + reqs[prev]!.toZone;
    };
    const near = (a: number, b: number) => straightMeters(reqs[a]!.h.position, reqs[b]!.h.position) <= o.pairingRadiusMeters;

    /** best feasible insertion of request ri, over all vans and positions */
    const bestInsertion = (ri: number, skipVan = -1, onlyEmpty = false) => {
      let best: { v: number; seq: number[]; c: number; delta: number } | null = null;
      let bestV = -1, bestP = -1, bestC = Infinity, bestDelta = Infinity;
      let feasibleVans = 0;
      const r = reqs[ri]!;
      for (let v = 0; v < H; v++) {
        if (v === skipVan) continue;
        const van = vans[v]!;
        const len = van.seq.length;
        if (onlyEmpty && len > 0) continue;
        if (!compatible(van, r) || van.people + r.h.residents > van.helper.capacity) continue;
        let any = false;
        const from = van.pinned >= 0 && len > 0 ? 1 : 0;
        for (let p = from; p <= len; p++) {
          // cheap necessary conditions before the full evaluation
          if (p === 0 ? !(dH[v * R + ri]! <= r.deadline) : !near(van.seq[p - 1]!, ri)) continue;
          if (p > 0 && p < len && !near(ri, van.seq[p]!)) continue;
          const c = evaluate(v, van.seq, onlyEmpty ? exact : est, p, ri);
          if (c === Infinity) continue;
          any = true;
          const delta = c - van.completion;
          if (delta < bestDelta - 1e-9) { bestV = v; bestP = p; bestC = c; bestDelta = delta; }
        }
        if (any) feasibleVans++;
      }
      if (bestV >= 0) {
        const s = vans[bestV]!.seq;
        best = { v: bestV, seq: [...s.slice(0, bestP), ri, ...s.slice(bestP)], c: bestC, delta: bestDelta };
      }
      return { best, feasibleVans };
    };
    const apply = (v: number, seq: number[], c: number) => {
      const van = vans[v]!;
      van.seq = seq;
      van.completion = c;
      van.people = seq.reduce((s, ri) => s + reqs[ri]!.h.residents, van.base);
    };

    // ---- 1. pins ----
    const placed = new Uint8Array(R);
    const choices = new Int32Array(R); // how many helpers could serve this household when it was placed
    for (let v = 0; v < H; v++) {
      const van = vans[v]!;
      if (van.pinned < 0) continue;
      const c = evaluate(v, [van.pinned], est);
      if (c === Infinity) { van.pinned = -1; continue; }
      apply(v, [van.pinned], c);
      placed[van.pinned] = 1;
      choices[van.pinned] = 1;
    }

    // ---- 2. greedy insertion in deadline order ----
    const flagged: number[] = [];
    for (let ri = 0; ri < R; ri++) {
      if (placed[ri]) continue;
      const { best, feasibleVans } = bestInsertion(ri);
      if (best) { apply(best.v, best.seq, best.c); placed[ri] = 1; choices[ri] = feasibleVans; } else flagged.push(ri);
    }

    // ---- 3. local search: relocate single pickups while total completion time drops ----
    for (let pass = 0; pass < o.localSearchPasses; pass++) {
      let improved = false;
      for (let v = 0; v < H; v++) {
        const van = vans[v]!;
        for (let p = van.seq.length - 1; p >= 0; p--) {
          const ri = van.seq[p]!;
          if (ri === van.pinned) continue;
          const rest = van.seq.filter((_, i) => i !== p);
          const cRest = evaluate(v, rest, est);
          if (cRest === Infinity) continue;
          const saved = van.completion - cRest;
          const { best } = bestInsertion(ri, v);
          if (best && best.delta < saved - 1e-6) {
            apply(v, rest, cRest);
            apply(best.v, best.seq, best.c);
            improved = true;
          }
        }
      }
      if (!improved) break;
    }
    for (let k = flagged.length - 1; k >= 0; k--) {
      const ri = flagged[k]!;
      const { best, feasibleVans } = bestInsertion(ri);
      if (best) { apply(best.v, best.seq, best.c); placed[ri] = 1; choices[ri] = feasibleVans; flagged.splice(k, 1); }
    }

    // ---- 4. exact verification; cut trips at the first missed deadline ----
    const retry: number[] = [];
    for (let v = 0; v < H; v++) {
      const van = vans[v]!;
      if (van.seq.length === 0) continue;
      let time = 0, keep = van.seq.length;
      for (let i = 0; i < van.seq.length; i++) {
        const ri = van.seq[i]!;
        const d = i === 0 ? dH[v * R + ri]! : exact(van.seq[i - 1]!, ri);
        const arrive = time + d;
        if (!(arrive <= reqs[ri]!.deadline)) { keep = i; break; }
        time = arrive + reqs[ri]!.board;
      }
      if (keep < van.seq.length) {
        retry.push(...van.seq.slice(keep));
        const seq = van.seq.slice(0, keep);
        apply(v, seq, seq.length ? evaluate(v, seq, exact) : 0);
      } else {
        apply(v, van.seq, evaluate(v, van.seq, exact));
      }
    }
    retry.sort((a, b) => a - b);
    for (const ri of retry) {
      const { best, feasibleVans } = bestInsertion(ri, -1, true);
      if (best) { apply(best.v, best.seq, best.c); choices[ri] = feasibleVans; } else flagged.push(ri);
    }
    flagged.sort((a, b) => a - b);

    // ---- flag the rest; best-effort pickups that still beat the fire itself ----
    // A flagged home gets a best-effort trip from an IDLE helper that would still arrive before the fire
    // reaches it, ignoring the safety margin. (Appending to busy helpers was measured in the real sim and
    // did not help: it locks the home to a busy helper. The home stays flagged; the trip says "Best effort".)
    const bestEffortStops = new Set<number>();
    const flaggedOut: Unservable[] = [];
    for (const ri of flagged) {
      const r = reqs[ri]!;
      const busyReason = unservableReason(r, ri);
      let bestV = -1, bestC = Infinity, bestDelta = Infinity;
      if (Number.isFinite(r.fireIn)) {
        const strict = r.deadline;
        r.deadline = r.fireIn - 1e-6; // must arrive before the fire itself
        for (let v = 0; v < H; v++) {
          const van = vans[v]!;
          if (van.seq.length > 0 || van.pinned >= 0 || !compatible(van, r)) continue; // idle helpers only (see above)
          exactDH(v, ri); // best effort compares against the fire, not the deadline: needs the true time
          const c = evaluate(v, van.seq, exact, van.seq.length, ri);
          if (c === Infinity) continue;
          const delta = c - van.completion;
          if (delta < bestDelta - 1e-9) { bestV = v; bestC = c; bestDelta = delta; }
        }
        r.deadline = strict;
      }
      if (bestV >= 0) { apply(bestV, [...vans[bestV]!.seq, ri], bestC); bestEffortStops.add(ri); }
      flaggedOut.push({
        householdId: r.h.id,
        reason: bestV >= 0 ? `${busyReason}; a best-effort pickup was added that should arrive before the fire itself.` : `${busyReason}.`,
        bestEffort: bestV >= 0,
      });
    }

    function unservableReason(r: Req, ri: number): string {
      const cap = vans.filter((v) => !(r.wheelchair && !v.helper.wheelchairCapable));
      const people = `${r.h.residents} ${r.h.residents === 1 ? 'person' : 'people'}`;
      if (H === 0) return 'No helper is available';
      if (r.wheelchair && cap.length === 0) return 'No wheelchair-capable helper is available';
      if (cap.every((v) => v.helper.capacity - v.base < r.h.residents)) return `No available helper has room for ${people}`;
      if (vans.every((_, v) => exactDH(v, ri) === Infinity)) return 'No helper can reach this home because the fire has cut off the roads';
      // a free helper could make it, so the problem is that every one of them is committed elsewhere
      const couldMakeIt = vans.some((van, v) => compatible(van, r) && dH[v * R + ri]! <= r.deadline);
      if (couldMakeIt) return `Every helper that could reach this home in time is already committed to homes with earlier deadlines (${minutes(r.deadline)} left)`;
      return `No helper can arrive before the safety deadline (${minutes(r.deadline)} from now)`;
    }

    // ---- build assignments ----
    const out: Assignment[] = [];
    const newMemory = new Map<string, string[]>();
    const emit = (v: number, seq: number[]) => {
      const van = vans[v]!;
      const arrivals: number[] = [];
      let time = 0;
      seq.forEach((ri, i) => {
        const arrive = time + (i === 0 ? dH[v * R + ri]! : exact(seq[i - 1]!, ri));
        arrivals.push(arrive);
        time = arrive + reqs[ri]!.board;
      });
      // report the stop with the least slack, so etaSeconds <= deadlineSeconds iff every stop is on time
      let crit = 0;
      for (let i = 1; i < seq.length; i++) {
        if (reqs[seq[i]!]!.deadline - arrivals[i]! < reqs[seq[crit]!]!.deadline - arrivals[crit]!) crit = i;
      }
      const critReq = reqs[seq[crit]!]!;
      const last = reqs[seq[seq.length - 1]!]!;
      const zone = world.safeZones[last.zone];
      const stops: LatLng[] = [van.pos, ...seq.map((ri) => reqs[ri]!.h.position)];
      if (zone) stops.push(zone.position);
      const route: LatLng[] = [];
      for (let i = 1; i < stops.length; i++) {
        const leg = router.route(stops[i - 1]!, stops[i]!, t);
        const pts = leg.length ? leg : [stops[i - 1]!, stops[i]!];
        route.push(...(route.length ? pts.slice(1) : pts));
      }
      const householdIds = seq.map((ri) => reqs[ri]!.h.id);
      const key = `${van.helper.id}|${householdIds[0]}`;
      let id = ids.get(key);
      if (!id) { id = `a${nextId++}`; ids.set(key, id); }
      newMemory.set(id, householdIds);
      out.push({
        id,
        helperId: van.helper.id,
        householdIds,
        route,
        etaSeconds: arrivals[crit]!,
        deadlineSeconds: critReq.deadline,
        reason: bestEffortStops.has(seq[crit]!) ? bestEffortReason(van, seq, arrivals[crit]!, critReq) : reasonFor(v, seq, arrivals, crit),
      });
    };

    function label(van: Van) {
      return `${KIND_LABEL[van.helper.kind]}${van.helper.wheelchairCapable && van.helper.kind !== 'accessible_van' ? ' (wheelchair-capable)' : ''}`;
    }
    function reasonFor(v: number, seq: number[], arrivals: number[], crit: number): string {
      const van = vans[v]!;
      const first = reqs[seq[0]!]!;
      const slack = reqs[seq[crit]!]!.deadline - arrivals[crit]!;
      const parts = [`${label(van)} is ${minutes(arrivals[0]!)} away`];
      if (first.deadline < o.unthreatenedDeadlineSeconds) parts.push(`arrives ${minutes(slack)} before the safety deadline`);
      if (seq.length > 1) parts.push(`picks up ${seq.length} homes (${van.people - van.base} people) on one trip`);
      let tail = '';
      if (van.pinned === seq[0]) tail = '; it is already on the way';
      else if (first.wheelchair && choices[seq[0]!] === 1) tail = '; it is the only wheelchair-capable helper that can make it in time';
      else if (choices[seq[0]!] === 1) tail = '; it is the only helper that can make it in time';
      return `${parts.join(', ')}${tail}.`;
    }
    function bestEffortReason(van: Van, seq: number[], arrive: number, r: Req): string {
      const when = seq.length > 1 ? `will come after its other ${seq.length - 1 === 1 ? 'pickup' : `${seq.length - 1} pickups`}` : `is ${minutes(arrive)} away`;
      return `Best effort: no helper can beat the safety deadline, but this ${label(van).toLowerCase()} ${when} and should arrive ${minutes(r.fireIn - arrive)} before the fire.`;
    }

    for (let v = 0; v < H; v++) if (vans[v]!.seq.length) emit(v, vans[v]!.seq);

    memory = newMemory;
    unservable = flaggedOut;
    return out;
  };

  return { plan, lastUnservable: () => unservable };
}
