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
];
