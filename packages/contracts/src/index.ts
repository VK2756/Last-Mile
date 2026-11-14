// =====================================================================
// @lastmile/contracts — THE source of truth shared by engine, web, data.
// Changing anything here = a "contract change": see CLAUDE.md §Contract rule.
// Coordinates: LatLng objects use {lat,lng}; GeoJSON-style tuples are [lng,lat].
// =====================================================================
import { z } from 'zod';

export const LatLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export type LatLng = z.infer<typeof LatLng>;
export const LngLat = z.tuple([z.number(), z.number()]);
export type LngLat = z.infer<typeof LngLat>;

// ---------- World ----------
export const Need = z.enum([
  'no_vehicle', 'wheelchair', 'oxygen', 'dementia', 'vision_impaired', 'hearing_impaired',
  'medical_device', 'young_children', 'pets', 'limited_english', 'no_cell_signal',
]);
export type Need = z.infer<typeof Need>;

export const Household = z.object({
  id: z.string(),
  name: z.string().optional(),
  position: LatLng,
  residents: z.number().int().min(1).max(12),
  language: z.string().default('en'),
  needs: z.array(Need),
  hasVehicle: z.boolean(),
  landlineOnly: z.boolean().default(false),
});
export type Household = z.infer<typeof Household>;

/** "Vulnerable" = anything that makes self-evacuation unlikely. Single shared definition. */
export const VULNERABLE_NEEDS: Need[] = ['no_vehicle', 'wheelchair', 'oxygen', 'dementia', 'medical_device', 'vision_impaired'];
export const isVulnerable = (h: Pick<Household, 'needs' | 'hasVehicle'>) =>
  !h.hasVehicle || h.needs.some((n) => VULNERABLE_NEEDS.includes(n));

export const HelperKind = z.enum(['neighbor', 'volunteer', 'accessible_van', 'shuttle_bus']);
export const Helper = z.object({
  id: z.string(),
  kind: HelperKind,
  position: LatLng,
  capacity: z.number().int().min(1),
  wheelchairCapable: z.boolean(),
});
export type Helper = z.infer<typeof Helper>;

// ---------- Scenario ----------
export const Policy = z.enum(['alerts_only', 'last_mile']);
export type Policy = z.infer<typeof Policy>;

/** Relative weights of helper kinds (missing kind = 0). Default fleet when absent: the engine's built-in mix. */
export const HelperMix = z.object({
  neighbor: z.number().min(0), volunteer: z.number().min(0), accessible_van: z.number().min(0), shuttle_bus: z.number().min(0),
}).partial().refine((m) => Object.values(m).reduce((a, b) => a + (b ?? 0), 0) > 0, { message: 'helperMix needs at least one positive weight' });
export type HelperMix = z.infer<typeof HelperMix>;

/** Baseline-fairness knobs. All optional; absent = the documented default, so existing results do not move. Applied identically to BOTH policies. */
export const BaselineKnobs = z.object({
  /** share of vehicle-less households with a relative/friend who will pick them up (default 0.25) */
  familyPickupProb: z.number().min(0).max(1).optional(),
  /** multiplies the time residents with a vehicle need to get on the road after being warned (default 1) */
  prepDelayScale: z.number().min(0.1).max(5).optional(),
  /** seconds after ignition when the official alert goes out (default 300) */
  alertIssueS: z.number().min(0).max(3600).optional(),
  /** family pickups hurry when the fire is near: delay = min(drawn delay, max(120 s, 0.5 x time-to-impact at warning)) (default false) */
  urgentFamilyPickup: z.boolean().optional(),
  /** probability that a departing household with a car and a free seat takes the nearest vehicle-less neighbour within about 300 m, at most one stop (default 0) */
  neighborRideProb: z.number().min(0).max(1).optional(),
});
export type BaselineKnobs = z.infer<typeof BaselineKnobs>;

export const ScenarioConfig = z.object({
  seed: z.number().int(),
  town: z.enum(['amherst', 'paradise_like', 'synthetic_grid']).default('amherst'),
  helperCount: z.number().int().min(0).max(200).default(24),
  wind: z.object({ speedMph: z.number().min(0).max(80), dirDeg: z.number().min(0).max(360) }),
  ignition: LatLng,
  policy: Policy,
  speedMultiplier: z.number().min(0.25).max(60).default(8),
  /** optional fleet knobs (default: built-in mix, capacities neighbor 3, volunteer 4, van 6, bus 12) */
  helperMix: HelperMix.optional(),
  helperCapacityScale: z.number().min(0.25).max(4).optional(),
  /** optional baseline knobs, see BaselineKnobs */
  baseline: BaselineKnobs.optional(),
});
export type ScenarioConfig = z.infer<typeof ScenarioConfig>;

// ---------- Live state (streamed) ----------
export const HouseholdStatus = z.enum([
  'unaware', 'warned', 'self_evacuating', 'needs_help', 'assigned', 'enroute', 'evacuated', 'trapped',
]);
export type HouseholdStatus = z.infer<typeof HouseholdStatus>;

export const HouseholdState = z.object({
  id: z.string(),
  status: HouseholdStatus,
  /** seconds until fire reaches this household; null = not currently threatened */
  ttiSeconds: z.number().nullable(),
});
export type HouseholdState = z.infer<typeof HouseholdState>;

export const HelperState = z.object({
  id: z.string(),
  position: LatLng,
  status: z.enum(['idle', 'enroute', 'loaded', 'done']),
  assignmentId: z.string().nullable(),
  load: z.number().int().min(0),
});
export type HelperState = z.infer<typeof HelperState>;

export const Assignment = z.object({
  id: z.string(),
  helperId: z.string(),
  householdIds: z.array(z.string()).min(1),
  route: z.array(LatLng),
  etaSeconds: z.number(),
  deadlineSeconds: z.number(),
  /** Human-readable explainability, shown in the UI: "Why this helper?" */
  reason: z.string(),
});
export type Assignment = z.infer<typeof Assignment>;

export const Metrics = z.object({
  total: z.number().int(),
  evacuated: z.number().int(),
  trapped: z.number().int(),
  inProgress: z.number().int(),
  vulnerableTotal: z.number().int(),
  vulnerableEvacuated: z.number().int(),
  vulnerableTrapped: z.number().int(),
});
export type Metrics = z.infer<typeof Metrics>;

export const SimFrame = z.object({
  scenarioId: z.string(),
  policy: Policy,
  /** simulated seconds since ignition */
  t: z.number(),
  fire: z.object({ rings: z.array(z.array(LngLat)), burnedFraction: z.number().min(0).max(1) }),
  households: z.array(HouseholdState),
  helpers: z.array(HelperState),
  assignments: z.array(Assignment),
  metrics: Metrics,
});
export type SimFrame = z.infer<typeof SimFrame>;

export const SimInit = z.object({
  scenarioId: z.string(),
  config: ScenarioConfig,
  bounds: z.object({ sw: LatLng, ne: LatLng }),
  households: z.array(Household),
  helpers: z.array(Helper),
  safeZones: z.array(z.object({ id: z.string(), name: z.string(), position: LatLng })),
  /** Plain-English list of modelling assumptions. UI MUST show them; pitch MUST say "simulation". */
  assumptions: z.array(z.string()),
});
export type SimInit = z.infer<typeof SimInit>;

/** Server-Sent Events payload: one JSON StreamEvent per `data:` line. */
export const StreamEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('init'), init: SimInit }),
  z.object({ type: z.literal('frame'), frame: SimFrame }),
  z.object({ type: z.literal('end'), scenarioId: z.string(), final: Metrics }),
]);
export type StreamEvent = z.infer<typeof StreamEvent>;

// ---------- Monte Carlo ----------
const CI = z.tuple([z.number(), z.number()]);
export const PolicyStats = z.object({
  evacuatedRate: z.object({ mean: z.number(), ci95: CI }),
  vulnerableEvacuatedRate: z.object({ mean: z.number(), ci95: CI }),
  trappedMean: z.number(),
});
export const MonteCarloComparison = z.object({
  runs: z.number().int(),
  base: ScenarioConfig.omit({ policy: true, seed: true }),
  results: z.object({ alerts_only: PolicyStats, last_mile: PolicyStats }),
  /** paired difference in vulnerable evacuated rate: last_mile - alerts_only */
  vulnerableLift: z.object({ mean: z.number(), ci95: CI }),
  assumptions: z.array(z.string()),
});
export type MonteCarloComparison = z.infer<typeof MonteCarloComparison>;

// ---------- Voice triage (Gemini) ----------
export const TriageRequest = z.object({
  householdId: z.string(),
  language: z.string().default('en'),
  utterance: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(['agent', 'resident']), text: z.string() })).default([]),
});
export type TriageRequest = z.infer<typeof TriageRequest>;

export const TriageResult = z.object({
  householdId: z.string(),
  needs: z.array(Need),
  hasRide: z.boolean().nullable(),
  canWalkToRoad: z.boolean().nullable(),
  residents: z.number().int().nullable(),
  urgency: z.number().int().min(1).max(5),
  /** What the voice agent says next, in the resident's language. */
  reply: z.string(),
  summary: z.string(),
  done: z.boolean(),
});
export type TriageResult = z.infer<typeof TriageResult>;

// ---------- HTTP surface (engine on Vultr) ----------
export const ENGINE_ROUTES = {
  health: 'GET /health',
  createScenario: 'POST /scenarios            body: ScenarioConfig -> { scenarioId }',
  stream: 'GET  /scenarios/:id/stream    SSE of StreamEvent',
  control: 'POST /scenarios/:id/control   body: { action: "pause"|"resume"|"speed", value?: number }',
  applyTriage: 'POST /scenarios/:id/households/:hid/needs   body: TriageResult',
  monteCarlo: 'POST /montecarlo           body: { base, runs } -> MonteCarloComparison',
} as const;

// ---------- Data sink (implemented by packages/data, consumed by engine) ----------
export interface RiskSample { scenarioId: string; policy: Policy; t: number; householdId: string; ttiSeconds: number | null; status: HouseholdStatus }
export interface DispatchEvent { scenarioId: string; policy: Policy; t: number; assignmentId: string; helperId: string; householdIds: string[]; etaSeconds: number; reason: string }
export interface OutcomeRecord { scenarioId: string; policy: Policy; seed: number; metrics: Metrics }
export interface DataSink {
  recordRisk(samples: RiskSample[]): Promise<void>;
  recordDispatch(e: DispatchEvent): Promise<void>;
  recordOutcome(o: OutcomeRecord): Promise<void>;
}
/** Engine uses this until Lane C's real sink exists, and in tests. */
export function createMemorySink(): DataSink & { risk: RiskSample[]; dispatches: DispatchEvent[]; outcomes: OutcomeRecord[] } {
  const risk: RiskSample[] = []; const dispatches: DispatchEvent[] = []; const outcomes: OutcomeRecord[] = [];
  return {
    risk, dispatches, outcomes,
    async recordRisk(s) { risk.push(...s); },
    async recordDispatch(e) { dispatches.push(e); },
    async recordOutcome(o) { outcomes.push(o); },
  };
}
export * from './engine';
