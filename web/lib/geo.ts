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
