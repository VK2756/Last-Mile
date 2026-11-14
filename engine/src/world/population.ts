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
}

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

function drawHousehold(i: number, rng: Rng, graph: RoadGraph): { hh: Household; beh: Behavior } {
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
    prepS: Math.min(1800, 120 + rng.exp(240) + (needs.includes('young_children') ? 60 : 0) + (needs.includes('pets') ? 60 : 0)),
    familyPickup: rng.chance(P.familyPickup),
    pickupDelayS: 900 + rng.range(0, 1500),
    helpRequestDelayS: rng.range(60, 180),
  };
  return { hh, beh };
}

export function generatePopulation(config: ScenarioConfig, graph: RoadGraph, fire: FireModel): Population {
  const rng = createRng(config.seed, SALT.population);
  const households: Household[] = []; const behavior: Record<string, Behavior> = {};
  for (let i = 0; i < HOUSEHOLD_COUNT; i++) { const { hh, beh } = drawHousehold(i, rng, graph); households.push(hh); behavior[hh.id] = beh; }
  const hr = createRng(config.seed, SALT.helpers);
  const helpers: Helper[] = [];
  for (let i = 0; i < config.helperCount; i++) {
    const kind = HELPER_PATTERN[i % HELPER_PATTERN.length]!; const node = hr.pick(graph.nodes);
    helpers.push(Helper.parse({ id: `p${i + 1}`, kind, position: { lat: node.lat, lng: node.lng }, ...HELPER_SPEC[kind] }));
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
    `The official alert goes out ${ALERT_ISSUE_S} s after ignition. Each household acts on it after a random delay (mean 150 s; +300 s landline-only, +120 s limited English, +240 s no cell signal).`,
    'Helpers (neighbors, volunteers, accessible vans, shuttle buses) start at random road nodes; vans and buses are wheelchair-capable. Capacity counts people.',
    `Safe zones are the 3 road nodes the fire reaches last (at least 1.4 km apart). Only the ${HOUSEHOLD_COUNT} synthetic households within the modeled road area exist; the road network is a synthetic grid unless a baked town is loaded.`,
  ];
  return { households, helpers, safeZones, behavior, bounds, assumptions };
}
