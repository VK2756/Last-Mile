// Scenario presets: GET {ENGINE}/presets (Lane A, engine/src/sim/presets.ts), with a local copy as the
// fallback for mock mode or an unreachable engine. Presets are plain configs, not tuned outcomes.
import { ScenarioConfig, type LatLng } from '@lastmile/contracts';
import { engineUrl } from './engine';
import type { BaseConfig } from './scenario';

export interface Preset { id: string; name: string; description: string; config: ScenarioConfig }

/** Validate one preset from the engine (throws if off-contract). */
export function parsePreset(raw: unknown): Preset {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.description !== 'string') throw new Error('preset missing id/name/description');
  return { id: o.id, name: o.name, description: o.description, config: ScenarioConfig.parse(o.config) };
}

const CENTER = { lat: 42.3732, lng: -72.5199 };
/** metres east/north of town centre -> LatLng (same local frame as the engine's fromXY, to within metres) */
export function offset(x: number, y: number, c: LatLng = CENTER): LatLng {
  const lat = c.lat + y / 111_320;
  const lng = c.lng + x / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

/** Mirror of the engine's PRESETS, used until/unless GET /presets answers. */
export const FALLBACK_PRESETS: Preset[] = [
  {
    id: 'wind-driven-run', name: 'Wind-driven run',
    description: 'Strong 25 mph wind drives a fast fire through the middle of town: the hardest case for people who cannot drive.',
    config: { seed: 2026, town: 'amherst', helperCount: 24, wind: { speedMph: 25, dirDeg: 90 }, ignition: offset(-900, 0), policy: 'last_mile', speedMultiplier: 8 },
  },
  {
    id: 'crosswind-flank', name: 'Crosswind flank',
    description: 'A moderate wind pushes the fire from the south side of town; roads close on the flank while helpers are already moving.',
    config: { seed: 7, town: 'amherst', helperCount: 24, wind: { speedMph: 15, dirDeg: 45 }, ignition: offset(-300, -900), policy: 'last_mile', speedMultiplier: 8 },
  },
  {
    id: 'slow-burn-few-helpers', name: 'Slow burn, few helpers',
    description: 'A calm, slow fire gives everyone time, but only 8 helpers are available: does help still matter when capacity is the limit?',
    config: { seed: 42, town: 'amherst', helperCount: 8, wind: { speedMph: 6, dirDeg: 135 }, ignition: offset(0, 700), policy: 'last_mile', speedMultiplier: 8 },
  },
];

export async function fetchPresets(timeoutMs = 4000): Promise<Preset[]> {
  const base = engineUrl();
  if (!base) throw new Error('NEXT_PUBLIC_ENGINE_URL is not set');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/presets`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`/presets -> HTTP ${res.status}`);
    const raw: unknown = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('/presets returned no presets');
    return raw.slice(0, 3).map(parsePreset);
  } finally {
    clearTimeout(timer);
  }
}

/** Preset -> run config, keeping the user's playback speed. */
export function presetBase(p: Preset, speedMultiplier: number): BaseConfig {
  const { policy: _policy, ...rest } = p.config;
  void _policy;
  return { ...rest, speedMultiplier };
}

/** A fresh random scenario near town centre. `rnd` is injectable for tests. */
export function randomBase(current: BaseConfig, rnd: () => number = Math.random): BaseConfig {
  const r = (lo: number, hi: number) => lo + (hi - lo) * rnd();
  return {
    ...current,
    seed: Math.floor(r(1, 100_000)),
    helperCount: Math.round(r(6, 40)),
    wind: { speedMph: Math.round(r(4, 30)), dirDeg: Math.round(r(0, 359)) },
    ignition: offset(r(-1200, 1200), r(-1000, 1000)),
  };
}

export function sameBase(a: BaseConfig, b: BaseConfig): boolean {
  return a.seed === b.seed && a.town === b.town && a.helperCount === b.helperCount && a.wind.speedMph === b.wind.speedMph
    && a.wind.dirDeg === b.wind.dirDeg && a.ignition.lat === b.ignition.lat && a.ignition.lng === b.ignition.lng;
}
