// Engine-internal interfaces (all owned by Lane A, kept as interfaces so pieces can be built in any order).
// A implements the simulator + calls Router/Dispatcher. B implements Router/Dispatcher/Monte Carlo.
import type { LatLng, LngLat, Household, Helper, HouseholdState, HelperState, Assignment, ScenarioConfig, Metrics } from './index';

export interface RoadNode { id: number; lat: number; lng: number }
export interface RoadEdge { from: number; to: number; meters: number; speedMph: number }
export interface RoadGraph { nodes: RoadNode[]; edges: RoadEdge[] }

/** Implemented by A (sim/fire). */
export interface FireModel {
  /** simulated seconds after ignition when the fire reaches p; Infinity if never */
  ignitionTime(p: LatLng): number;
  isBurning(p: LatLng, t: number): boolean;
  rings(t: number): LngLat[][];
  burnedFraction(t: number): number;
}

/** Implemented by B (routing). Must respect roads blocked by the fire at time t. */
export interface Router {
  travelSeconds(a: LatLng, b: LatLng, t: number): number; // Infinity if unreachable
  route(a: LatLng, b: LatLng, t: number): LatLng[];
}

export interface WorldSnapshot {
  t: number;
  config: ScenarioConfig;
  households: Household[];
  householdStates: Record<string, HouseholdState>;
  helpers: Helper[];
  helperStates: Record<string, HelperState>;
  safeZones: { id: string; name: string; position: LatLng }[];
  fire: FireModel;
  router: Router;
}

/** Implemented by B (dispatch). Called by A's tick loop every tick; must be fast (<20ms for 600 households). */
export interface Dispatcher {
  plan(world: WorldSnapshot): Assignment[];
}

/** Implemented by A (sim/headless): run a full scenario without streaming, return final metrics. Used by B's Monte Carlo. */
export type HeadlessRunner = (config: ScenarioConfig) => Promise<Metrics>;
