// Tiny hand-written fixtures so Lane B (web) can build the whole UI before the engine exists
// (use ?mock=1), and so every lane can contract-test against the same sample.
import type { SimInit, SimFrame } from './index';

export const sampleInit: SimInit = {
  scenarioId: 'demo-1',
  config: { seed: 1, town: 'amherst', helperCount: 2, wind: { speedMph: 20, dirDeg: 90 }, ignition: { lat: 42.3732, lng: -72.5199 }, policy: 'last_mile', speedMultiplier: 8 },
  bounds: { sw: { lat: 42.355, lng: -72.55 }, ne: { lat: 42.39, lng: -72.49 } },
  households: [
    { id: 'h1', position: { lat: 42.3745, lng: -72.5185 }, residents: 2, language: 'en', needs: ['no_vehicle', 'wheelchair'], hasVehicle: false, landlineOnly: true },
    { id: 'h2', position: { lat: 42.3712, lng: -72.5120 }, residents: 3, language: 'es', needs: ['limited_english'], hasVehicle: true, landlineOnly: false },
    { id: 'h3', position: { lat: 42.3690, lng: -72.5230 }, residents: 1, language: 'en', needs: ['oxygen', 'no_vehicle'], hasVehicle: false, landlineOnly: false },
  ],
  helpers: [
    { id: 'p1', kind: 'accessible_van', position: { lat: 42.3650, lng: -72.5300 }, capacity: 4, wheelchairCapable: true },
    { id: 'p2', kind: 'neighbor', position: { lat: 42.3700, lng: -72.5150 }, capacity: 3, wheelchairCapable: false },
  ],
  safeZones: [{ id: 'z1', name: 'Amherst Regional High School', position: { lat: 42.3590, lng: -72.5080 } }],
  assumptions: ['SYNTHETIC residents and helpers; not real people.', 'Fire spread is a simplified wind-driven cellular model.'],
};

export const sampleFrame: SimFrame = {
  scenarioId: 'demo-1',
  policy: 'last_mile',
  t: 300,
  fire: { rings: [[[-72.5215, 42.3722], [-72.5185, 42.3722], [-72.5185, 42.3742], [-72.5215, 42.3742], [-72.5215, 42.3722]]], burnedFraction: 0.04 },
  households: [
    { id: 'h1', status: 'assigned', ttiSeconds: 540 },
    { id: 'h2', status: 'self_evacuating', ttiSeconds: null },
    { id: 'h3', status: 'needs_help', ttiSeconds: 900 },
  ],
  helpers: [
    { id: 'p1', position: { lat: 42.3675, lng: -72.5270 }, status: 'enroute', assignmentId: 'a1', load: 0 },
    { id: 'p2', position: { lat: 42.3700, lng: -72.5150 }, status: 'idle', assignmentId: null, load: 0 },
  ],
  assignments: [
    { id: 'a1', helperId: 'p1', householdIds: ['h1'], route: [{ lat: 42.3675, lng: -72.527 }, { lat: 42.3745, lng: -72.5185 }, { lat: 42.359, lng: -72.508 }], etaSeconds: 210, deadlineSeconds: 480, reason: 'Wheelchair-capable van, 3.4 min away; arrives 5.5 min before fire; only helper that fits.' },
  ],
  metrics: { total: 3, evacuated: 0, trapped: 0, inProgress: 2, vulnerableTotal: 2, vulnerableEvacuated: 0, vulnerableTrapped: 0 },
};
