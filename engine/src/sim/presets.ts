// OWNER: Lane A. Three curated scenarios for the demo and for the headline table. They are plain ScenarioConfigs:
// nothing here is tuned to flatter Last Mile; the numbers come from running them (see docs/status/lane-a.md).
import type { ScenarioConfig } from '@lastmile/contracts';
import { fromXY } from './geo';

const CENTER = { lat: 42.3732, lng: -72.5199 };
const at = (x: number, y: number) => fromXY(x, y, CENTER);

export interface Preset { id: string; name: string; description: string; config: Omit<ScenarioConfig, 'policy'> & { policy: ScenarioConfig['policy'] } }

export const PRESETS: Preset[] = [
  {
    id: 'wind-driven-run', name: 'Wind-driven run',
    description: 'Strong 25 mph wind from the west drives a fast fire through the middle of town: the hardest case for people who cannot drive.',
    config: { seed: 2026, town: 'amherst', helperCount: 24, wind: { speedMph: 25, dirDeg: 90 }, ignition: at(-900, 0), policy: 'last_mile', speedMultiplier: 8 },
  },
  {
    id: 'crosswind-flank', name: 'Crosswind flank',
    description: 'A moderate wind pushes the fire northeast from the south side of town; roads close on the flank while helpers are already moving.',
    config: { seed: 7, town: 'amherst', helperCount: 24, wind: { speedMph: 15, dirDeg: 45 }, ignition: at(-300, -900), policy: 'last_mile', speedMultiplier: 8 },
  },
  {
    id: 'slow-burn-few-helpers', name: 'Slow burn, few helpers',
    description: 'A calm, slow fire gives everyone time, but only 8 helpers are available: does help still matter when capacity is the limit?',
    config: { seed: 42, town: 'amherst', helperCount: 8, wind: { speedMph: 6, dirDeg: 135 }, ignition: at(0, 700), policy: 'last_mile', speedMultiplier: 8 },
  },
  // Real-road stories (#81). Found by engine/scripts/find-stories.ts over 36 ignition x wind settings; each seed is the MEDIAN-lift
  // seed of 10, not the best one. They sit AFTER the first three so existing consumers keep their order. Outcomes come only from running them.
  {
    id: 'south-fire-cut-off', name: 'South fire, roads cut off',
    description: 'A fire 1.2 km south of downtown is pushed further south. Burning roads cut homes off, so about 7 homes per run cannot be reached at all: where Last Mile struggles.',
    config: { seed: 4, town: 'amherst', helperCount: 24, wind: { speedMph: 20, dirDeg: 180 }, ignition: { lat: 42.36242, lng: -72.5199 }, policy: 'last_mile', speedMultiplier: 8 },
  },
  {
    id: 'southeast-big-lift', name: 'Southeast fire, an hour of warning',
    description: 'A south-east ignition with the wind toward the south gives about an hour of warning but blocks the obvious ways out: the setting where coordinated dispatch helps most.',
    config: { seed: 10, town: 'amherst', helperCount: 24, wind: { speedMph: 20, dirDeg: 180 }, ignition: { lat: 42.36242, lng: -72.505309 }, policy: 'last_mile', speedMultiplier: 8 },
  },
  {
    id: 'downtown-north-wheelchair', name: 'Downtown fire, wheelchair homes wait',
    description: 'A downtown fire driven north toward campus puts many people at risk. Only vans and buses carry wheelchairs, so wheelchair households can wait up to about 12 minutes for one.',
    config: { seed: 7, town: 'amherst', helperCount: 24, wind: { speedMph: 20, dirDeg: 0 }, ignition: { lat: 42.3732, lng: -72.5199 }, policy: 'last_mile', speedMultiplier: 8 },
  },
];
