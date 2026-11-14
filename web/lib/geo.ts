// Pure SimInit/SimFrame -> GeoJSON builders for the map layers (unit-testable, no DOM).
import type { HouseholdState, SimFrame, SimInit } from '@lastmile/contracts';
import { householdIconName, helperIconName } from './map-icons';
import { STATUS_META, urgencyOf } from './status';

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
export type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;
const fc = (features: Feature[]): FC => ({ type: 'FeatureCollection', features });
export const EMPTY_FC: FC = fc([]);

const URGENCY_RANK = { safe: 0, calm: 1, watch: 2, urgent: 3, critical: 4, lost: 5 } as const;

export function householdsFC(init: SimInit, frame: SimFrame | null, selectedId: string | null): FC {
  const states = new Map<string, HouseholdState>((frame?.households ?? []).map((h) => [h.id, h]));
  return fc(
    init.households.map((h) => {
      const st = states.get(h.id);
      const status = st?.status ?? 'unaware';
      const tti = st?.ttiSeconds ?? null;
      const u = urgencyOf(status, tti);
      return {
        type: 'Feature',
        id: h.id,
        geometry: { type: 'Point', coordinates: [h.position.lng, h.position.lat] },
        properties: {
          id: h.id,
          icon: householdIconName(STATUS_META[status].shape, u),
          rank: URGENCY_RANK[u], // draw urgent on top
          selected: h.id === selectedId,
        },
      };
    }),
  );
}

export function helpersFC(frame: SimFrame | null): FC {
  if (!frame) return EMPTY_FC;
  return fc(
    frame.helpers.map((p) => ({
      type: 'Feature',
      id: p.id,
      geometry: { type: 'Point', coordinates: [p.position.lng, p.position.lat] },
      properties: { id: p.id, icon: helperIconName(p.status), active: p.status === 'enroute' || p.status === 'loaded' },
    })),
  );
}

export function routesFC(frame: SimFrame | null, selectedId: string | null): FC {
  if (!frame) return EMPTY_FC;
  return fc(
    frame.assignments
      .filter((a) => a.route.length >= 2)
      .map((a) => ({
        type: 'Feature',
        id: a.id,
        geometry: { type: 'LineString', coordinates: a.route.map((p) => [p.lng, p.lat]) },
        properties: { id: a.id, selected: selectedId !== null && a.householdIds.includes(selectedId) },
      })),
  );
}

export function fireFC(frame: SimFrame | null): FC {
  if (!frame || frame.fire.rings.length === 0) return EMPTY_FC;
  return fc(
    frame.fire.rings
      .filter((r) => r.length >= 4)
      .map((ring, i) => ({ type: 'Feature', id: i, geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} })),
  );
}

export function safeZonesFC(init: SimInit): FC {
  return fc(
    init.safeZones.map((z) => ({
      type: 'Feature',
      id: z.id,
      geometry: { type: 'Point', coordinates: [z.position.lng, z.position.lat] },
      properties: { id: z.id, name: z.name },
    })),
  );
}

export function ignitionFC(init: SimInit): FC {
  const p = init.config.ignition;
  return fc([{ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: {} }]);
}

/** Faint lat/lng grid for the no-tiles fallback basemap. */
export function gridFC(init: SimInit, step = 0.005): FC {
  const { sw, ne } = init.bounds;
  const pad = 0.05;
  const lines: Feature[] = [];
  for (let lng = Math.floor((sw.lng - pad) / step) * step; lng <= ne.lng + pad; lng += step)
    lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lng, sw.lat - pad], [lng, ne.lat + pad]] }, properties: {} });
  for (let lat = Math.floor((sw.lat - pad) / step) * step; lat <= ne.lat + pad; lat += step)
    lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[sw.lng - pad, lat], [ne.lng + pad, lat]] }, properties: {} });
  return fc(lines);
}

/** Small deterministic hash -> [0, 1). Same inputs, same ember: no flicker between identical frames. */
function hash01(a: number, b: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/**
 * Decorative embers just outside the fire front (purely visual, not model output): every few
 * ring vertices, pushed outward from the ring's centroid by 30-150 m. They re-seed every 20
 * sim-seconds, so they drift with the front instead of jittering every frame.
 */
export function embersFC(frame: SimFrame | null, maxPerRing = 48): FC {
  if (!frame || frame.fire.rings.length === 0) return EMPTY_FC;
  const bucket = Math.floor(frame.t / 20);
  const features: FC['features'] = [];
  frame.fire.rings.forEach((ring, r) => {
    if (ring.length < 4) return;
    const n = ring.length - 1;
    const cx = ring.slice(0, n).reduce((s, p) => s + p[0], 0) / n;
    const cy = ring.slice(0, n).reduce((s, p) => s + p[1], 0) / n;
    const mPerLng = 111_320 * Math.cos((cy * Math.PI) / 180);
    const step = Math.max(1, Math.floor(n / maxPerRing));
    for (let i = 0; i < n; i += step) {
      const [x, y] = ring[i]!;
      const dx = (x - cx) * mPerLng;
      const dy = (y - cy) * 111_320;
      const len = Math.hypot(dx, dy) || 1;
      const u = hash01(r * 7919 + i, bucket);
      const v = hash01(i * 104729 + r, bucket + 1);
      const d = 30 + 120 * u;
      const side = (v - 0.5) * 0.6; // a little sideways scatter
      const ox = (dx / len) * d - (dy / len) * d * side;
      const oy = (dy / len) * d + (dx / len) * d * side;
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [x + ox / mPerLng, y + oy / 111_320] }, properties: { a: 0.25 + 0.55 * v, r: 0.8 + 1.6 * u } });
    }
  });
  return fc(features);
}
