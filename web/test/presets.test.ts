import { describe, expect, it } from 'vitest';
import { ScenarioConfig } from '@lastmile/contracts';
import { FALLBACK_PRESETS, parsePreset, presetBase, randomBase, sameBase } from '../lib/presets';
import { mulberry32 } from '../lib/mock';

describe('presets', () => {
  it('built-in presets are valid configs', () => {
    expect(FALLBACK_PRESETS).toHaveLength(3);
    for (const p of FALLBACK_PRESETS) expect(() => ScenarioConfig.parse(p.config)).not.toThrow();
  });
  it('parsePreset rejects off-contract presets', () => {
    expect(() => parsePreset({ id: 'x', name: 'x', description: 'x', config: { seed: 1 } })).toThrow();
    expect(parsePreset(FALLBACK_PRESETS[0]).id).toBe('wind-driven-run');
  });
  it('presetBase keeps the playback speed; randomize is a valid, different config', () => {
    const b = presetBase(FALLBACK_PRESETS[0]!, 30);
    expect(b.speedMultiplier).toBe(30);
    const r = randomBase(b, mulberry32(5));
    expect(sameBase(r, b)).toBe(false);
    expect(() => ScenarioConfig.parse({ ...r, policy: 'last_mile' })).not.toThrow();
    expect(sameBase(randomBase(b, mulberry32(5)), r)).toBe(true);
  });
});
