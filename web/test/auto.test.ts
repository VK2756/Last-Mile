import { describe, expect, it } from 'vitest';
import { AUTO_NEXT_MS, autoAction, nextPresetIndex } from '../lib/auto';

describe('auto mode', () => {
  it('cycles presets and wraps', () => {
    const ids = ['a', 'b', 'c'];
    expect(nextPresetIndex('a', ids)).toBe(1);
    expect(nextPresetIndex('c', ids)).toBe(0);
    expect(nextPresetIndex(null, ids)).toBe(0);
    expect(nextPresetIndex('zzz', ids)).toBe(0);
    expect(nextPresetIndex('a', [])).toBe(-1);
  });
  it('waits 5 s after a run ends, retries after an error, otherwise does nothing', () => {
    expect(autoAction('ended')).toEqual({ kind: 'next', ms: AUTO_NEXT_MS });
    expect(autoAction('error')?.kind).toBe('retry');
    expect(autoAction('live')).toBeNull();
    expect(autoAction('reconnecting')).toBeNull();
  });
});

import { engineRetryDelay } from '../lib/fallback';
describe('engine-unreachable retry', () => {
  it('backs off 5, 10, 15 s then every 30 s', () => {
    expect([0, 1, 2, 3, 4, 50].map(engineRetryDelay)).toEqual([5000, 10000, 15000, 30000, 30000, 30000]);
    expect(engineRetryDelay(-1)).toBe(5000);
  });
});
