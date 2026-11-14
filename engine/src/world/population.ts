// OWNER: Lane A. Seeded synthetic households, helpers, safe zones and per-household behaviour draws.
// Everything here depends only on (seed, helperCount, road graph, fire), NEVER on the policy, so both policies
// of a paired run see exactly the same people, helpers and fire.
import { Household, Helper, type FireModel, type Need, type RoadGraph, type ScenarioConfig, type LatLng } from '@lastmile/contracts';
import { createRng, SALT, type Rng } from '../sim/rng';
import { distMeters, fromXY, M_PER_DEG_LAT } from '../sim/geo';

export const HOUSEHOLD_COUNT = 600;
/** seconds after ignition when the official evacuation alert goes out */
export const ALERT_ISSUE_S = 300;
export const P = {
  noVehicle: 0.12, wheelchair: 0.06, oxygen: 0.025, medicalDevice: 0.015, limitedEnglish: 0.08, landlineOnly: 0.10,
  dementia: 0.02, vision: 0.02, hearing: 0.03, youngChildren: 0.15, pets: 0.30, noCell: 0.04,
  familyPickup: 0.25,
} as const;

/** Pre-drawn, policy-independent random behaviour of each household (seconds are simulated seconds). */
export interface Behavior {
  /** delay after ALERT_ISSUE_S until this household actually receives/acts on the alert */
  alertDelayS: number;
  /** time from being warned until a household with a vehicle is on the road */
  prepS: number;
  /** a relative/friend will pick this (vehicle-less) household up */
  familyPickup: boolean;
  /** time from being warned until the family pickup vehicle leaves */
  pickupDelayS: number;
  /** time from being warned until a help request reaches Last Mile (last_mile policy only) */
  helpRequestDelayS: number;
  /** uniform [0,1) roll from its own RNG stream: this household offers a neighbour a seat if the roll is below neighborRideProb */
  rideRoll: number;
}

/** Knobs for sensitivity tests. Defaults are the headline assumptions; every non-default is listed in SimInit.assumptions. */
export interface Variant {
  /** seconds between being warned and the help request reaching dispatch (last_mile only) */
  helpDelayS?: [number, number];
  /** where helpers start: random road nodes, or only among the 30% of nodes the fire reaches last */
  helperPlacement?: 'random' | 'far_from_fire';
}
export const DEFAULT_HELP_DELAY_S: [number, number] = [60, 180];
export const minutes = (s: number) => `${Math.round((s / 60) * 10) / 10}`;

export interface SafeZone { id: string; name: string; position: LatLng }
export interface Population {
  households: Household[];
  helpers: Helper[];
  safeZones: SafeZone[];
  behavior: Record<string, Behavior>;
  bounds: { sw: LatLng; ne: LatLng };
  assumptions: string[];
}

const HELPER_PATTERN = ['neighbor', 'volunteer', 'neighbor', 'accessible_van', 'neighbor', 'volunteer', 'neighbor', 'shuttle_bus', 'neighbor', 'accessible_van'] as const;
export type HelperKind = keyof typeof HELPER_SPEC;
const KIND_ORDER: HelperKind[] = ['neighbor', 'volunteer', 'accessible_van', 'shuttle_bus'];
/** Kinds for `n` helpers: the built-in repeating pattern, or helperMix weights split by largest remainder (no RNG used). */
export function helperKinds(n: number, mix?: ScenarioConfig['helperMix']): HelperKind[] {
  if (!mix) return Array.from({ length: n }, (_, i) => HELPER_PATTERN[i % HELPER_PATTERN.length]!);
  const w = KIND_ORDER.map((k) => mix[k] ?? 0); const total = w.reduce((a, b) => a + b, 0);
  const exact = w.map((x) => (x / total) * n); const counts = exact.map(Math.floor);
  let left = n - counts.reduce((a, b) => a + b, 0);
  exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i).slice(0, left).forEach(({ i }) => { counts[i]!++; });
  return KIND_ORDER.flatMap((k, i) => Array<HelperKind>(counts[i]!).fill(k));
}
const HELPER_SPEC = {
  neighbor: { capacity: 3, wheelchairCapable: false }, volunteer: { capacity: 4, wheelchairCapable: false },
  accessible_van: { capacity: 6, wheelchairCapable: true }, shuttle_bus: { capacity: 12, wheelchairCapable: true },
} as const;

function pickSafeZones(graph: RoadGraph, fire: FireModel): SafeZone[] {
  const ranked = graph.nodes.map((n) => ({ n, t: fire.ignitionTime(n) })).sort((a, b) => b.t - a.t || a.n.id - b.n.id);
  const chosen: typeof ranked = [];
  for (const c of ranked) {
    if (chosen.length === 3) break;
    if (chosen.every((o) => distMeters(o.n, c.n) >= 1400)) chosen.push(c);
  }
  for (const c of ranked) { if (chosen.length === 3) break; if (!chosen.includes(c)) chosen.push(c); }
  return chosen.map((c, i) => ({ id: `z${i + 1}`, name: `Safe zone ${String.fromCharCode(65 + i)}`, position: { lat: c.n.lat, lng: c.n.lng } }));
}

function drawHousehold(i: number, rng: Rng, graph: RoadGraph, helpDelay: [number, number], familyProb: number, prepScale: number): { hh: Household; beh: Behavior } {
  const node = rng.pick(graph.nodes);
  const pos = fromXY(rng.range(-35, 35), rng.range(-35, 35), { lat: node.lat, lng: node.lng });
  const needs: Need[] = [];
  const hasVehicle = !rng.chance(P.noVehicle);
  if (!hasVehicle) needs.push('no_vehicle');
  const flags: [number, Need][] = [[P.wheelchair, 'wheelchair'], [P.oxygen, 'oxygen'], [P.medicalDevice, 'medical_device'], [P.dementia, 'dementia'],
    [P.vision, 'vision_impaired'], [P.hearing, 'hearing_impaired'], [P.youngChildren, 'young_children'], [P.pets, 'pets'], [P.limitedEnglish, 'limited_english'], [P.noCell, 'no_cell_signal']];
  for (const [p, n] of flags) if (rng.chance(p)) needs.push(n);
  const landlineOnly = rng.chance(P.landlineOnly);
  const r = rng.next();
  const residents = r < 0.25 ? 1 : r < 0.58 ? 2 : r < 0.75 ? 3 : r < 0.90 ? 4 : r < 0.97 ? 5 : 6;
  const language = needs.includes('limited_english') ? rng.pick(['es', 'es', 'es', 'zh', 'pt']) : 'en';
  const hh = Household.parse({ id: `h${i + 1}`, position: pos, residents, language, needs, hasVehicle, landlineOnly });
  const alertMean = 150 + (landlineOnly ? 300 : 0) + (needs.includes('limited_english') ? 120 : 0) + (needs.includes('no_cell_signal') ? 240 : 0);
  const beh: Behavior = {
    alertDelayS: Math.min(3600, rng.exp(alertMean)),
    prepS: Math.min(1800, 120 + rng.exp(240) + (needs.includes('young_children') ? 60 : 0) + (needs.includes('pets') ? 60 : 0)) * prepScale,
    familyPickup: rng.chance(familyProb),
    pickupDelayS: 900 + rng.range(0, 1500),
    helpRequestDelayS: rng.range(helpDelay[0], helpDelay[1]),
    rideRoll: 0, // filled from a separate stream below so adding it never shifts the other draws
  };
  return { hh, beh };
}

export function generatePopulation(config: ScenarioConfig, graph: RoadGraph, fire: FireModel, variant: Variant = {}): Population {
  const helpDelay = variant.helpDelayS ?? DEFAULT_HELP_DELAY_S;
  const rng = createRng(config.seed, SALT.population);
  const households: Household[] = []; const behavior: Record<string, Behavior> = {};
  for (let i = 0; i < HOUSEHOLD_COUNT; i++) { const { hh, beh } = drawHousehold(i, rng, graph, helpDelay, config.baseline?.familyPickupProb ?? P.familyPickup, config.baseline?.prepDelayScale ?? 1); households.push(hh); behavior[hh.id] = beh; }
  const rideRng = createRng(config.seed, SALT.behavior);
  for (const h of households) behavior[h.id]!.rideRoll = rideRng.next();
  const hr = createRng(config.seed, SALT.helpers);
  const helpers: Helper[] = [];
  const kinds = helperKinds(config.helperCount, config.helperMix);
  const byLate = [...graph.nodes].sort((a, b) => fire.ignitionTime(b) - fire.ignitionTime(a) || a.id - b.id);
  const helperNodes = variant.helperPlacement === 'far_from_fire' ? byLate.slice(0, Math.max(1, Math.round(byLate.length * 0.3))) : graph.nodes;
  for (let i = 0; i < config.helperCount; i++) {
    const kind = kinds[i]!; const node = hr.pick(helperNodes);
    const spec = HELPER_SPEC[kind]; const capacity = Math.max(1, Math.round(spec.capacity * (config.helperCapacityScale ?? 1)));
    helpers.push(Helper.parse({ id: `p${i + 1}`, kind, position: { lat: node.lat, lng: node.lng }, capacity, wheelchairCapable: spec.wheelchairCapable }));
  }
  const safeZones = pickSafeZones(graph, fire);
  const lats = graph.nodes.map((n) => n.lat), lngs = graph.nodes.map((n) => n.lng);
  const mLat = 300 / M_PER_DEG_LAT, mLng = mLat / Math.cos((lats[0]! * Math.PI) / 180);
  const bounds = { sw: { lat: Math.min(...lats) - mLat, lng: Math.min(...lngs) - mLng }, ne: { lat: Math.max(...lats) + mLat, lng: Math.max(...lngs) + mLng } };
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
  const assumptions = [
    'ALL residents and helpers are SYNTHETIC (seeded random), not real people. This is a simulation.',
    `${HOUSEHOLD_COUNT} households placed within 35 m of road nodes. Household needs are drawn independently: no vehicle ${pct(P.noVehicle)}, wheelchair ${pct(P.wheelchair)}, oxygen ${pct(P.oxygen)}, other medical device ${pct(P.medicalDevice)}, dementia ${pct(P.dementia)}, vision impaired ${pct(P.vision)}, limited English ${pct(P.limitedEnglish)}, landline only ${pct(P.landlineOnly)}.`,
    'A household is "vulnerable" if it has no vehicle or any of: wheelchair, oxygen, dementia, medical device, vision impaired (single shared definition in the contracts).',
    `The official alert goes out ${config.baseline?.alertIssueS ?? ALERT_ISSUE_S} s after ignition${config.baseline?.alertIssueS !== undefined ? ' (SENSITIVITY: non-default)' : ''}. Each household acts on it after a random delay (mean 150 s; +300 s landline-only, +120 s limited English, +240 s no cell signal).`,
    variant.helperPlacement === 'far_from_fire'
      ? 'SENSITIVITY: helpers (neighbors, volunteers, accessible vans, shuttle buses) start only on the 30% of road nodes the fire reaches last (far from the fire); vans and buses are wheelchair-capable. Capacity counts people.'
      : 'Helpers (neighbors, volunteers, accessible vans, shuttle buses) start at random road nodes; vans and buses are wheelchair-capable. Capacity counts people.',
    ...(config.helperMix ? [`SENSITIVITY: helper fleet mix is set explicitly (weights ${KIND_ORDER.map((k) => `${k} ${config.helperMix?.[k] ?? 0}`).join(', ')}) instead of the built-in mix.`] : []),
    ...(config.helperCapacityScale !== undefined && config.helperCapacityScale !== 1 ? [`SENSITIVITY: helper seat capacities are scaled by ${config.helperCapacityScale} (default capacities: neighbor 3, volunteer 4, accessible van 6, shuttle bus 12; minimum 1).`] : []),
    `Last Mile only learns of a household that cannot drive ${minutes(helpDelay[0])} to ${minutes(helpDelay[1])} min after that household is warned${variant.helpDelayS ? ' (SENSITIVITY: non-default)' : ''}.`,
    `Safe zones are the 3 road nodes the fire reaches last (at least 1.4 km apart). Only the ${HOUSEHOLD_COUNT} synthetic households within the modeled road area exist; the road network is a synthetic grid unless a baked town is loaded.`,
  ];
  return { households, helpers, safeZones, behavior, bounds, assumptions };
}
