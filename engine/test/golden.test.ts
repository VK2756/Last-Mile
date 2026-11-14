import { describe, expect, it } from 'vitest';
import { PRESET_BASE } from '../src/montecarlo';
import { runHeadlessWith } from '../src/sim/headless';

// Golden metrics captured BEFORE the baseline/fleet knobs existed. Optional knobs absent must never move these numbers.
// If this test fails you changed default behaviour: that needs a deliberate, documented decision, not a quiet edit.
const GOLDEN: Record<string, unknown> = {"3-alerts_only":{"total":269,"evacuated":195,"trapped":74,"inProgress":0,"vulnerableTotal":66,"vulnerableEvacuated":32,"vulnerableTrapped":34},"3-last_mile":{"total":269,"evacuated":209,"trapped":60,"inProgress":0,"vulnerableTotal":66,"vulnerableEvacuated":46,"vulnerableTrapped":20},"11-alerts_only":{"total":290,"evacuated":211,"trapped":79,"inProgress":0,"vulnerableTotal":62,"vulnerableEvacuated":31,"vulnerableTrapped":31},"11-last_mile":{"total":290,"evacuated":228,"trapped":62,"inProgress":0,"vulnerableTotal":62,"vulnerableEvacuated":48,"vulnerableTrapped":14}};

describe('defaults are unchanged by the optional knobs', () => {
  for (const seed of [3, 11]) for (const policy of ['alerts_only', 'last_mile'] as const) {
    it(`seed ${seed} ${policy}`, () => { expect(runHeadlessWith({ ...PRESET_BASE, seed, policy })).toEqual(GOLDEN[`${seed}-${policy}`]); });
  }
});
