import { describe, expect, it } from 'vitest';
import { checkFuzzSeed, fuzzConfig } from '../scripts/fuzz-invariants';

// The full sweep is `pnpm exec tsx scripts/fuzz-invariants.ts 300` (all optional knobs included); CI runs a few seeds
// so a regression in routing, dispatch or the sim's use of them fails fast.
describe('fuzzed invariants on the real Amherst graph', () => {
  it('fuzz configs only use public knobs and are reproducible', () => {
    expect(fuzzConfig(5)).toEqual(fuzzConfig(5));
    expect(fuzzConfig(5)).not.toEqual(fuzzConfig(6));
    expect(fuzzConfig(5).town).toBe('amherst');
  });

  for (const seed of [1, 2, 3]) {
    it(`fuzz seed ${seed}: routes avoid fire, capacity/wheelchair rules hold, one helper per home, times finite, metrics add up, same fire for both policies, deterministic`, () => {
      expect(checkFuzzSeed(seed)).toEqual([]);
    }, 60_000);
  }
});
