// OWNER: Lane A (Engine). STUB: straight-line travel at 25 mph. Replace with graph routing that respects fire-blocked edges.
import type { LatLng, Router } from '@lastmile/contracts';
const M_PER_DEG = 111_320;
const meters = (a: LatLng, b: LatLng) => Math.hypot((a.lat - b.lat) * M_PER_DEG, (a.lng - b.lng) * M_PER_DEG * Math.cos((a.lat * Math.PI) / 180));
export function createRouter(): Router {
  return {
    travelSeconds: (a, b) => meters(a, b) / (25 * 0.44704),
    route: (a, b) => [a, b],
  };
}
