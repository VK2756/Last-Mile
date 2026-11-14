import { describe, expect, it } from 'vitest';
import { keyAction } from '../lib/keys';

describe('live shortcuts', () => {
  it('maps keys to actions', () => {
    expect(keyAction({ key: ' ' })).toEqual({ type: 'space' });
    expect(keyAction({ key: 'R' })).toEqual({ type: 'reset' });
    expect(keyAction({ key: '3' })).toEqual({ type: 'preset', index: 2 });
    expect(keyAction({ key: '?' })).toEqual({ type: 'help' });
    expect(keyAction({ key: 'x' })).toBeNull();
  });
  it('ignores modifier combos and typing in inputs', () => {
    expect(keyAction({ key: 'r', metaKey: true })).toBeNull();
    const input = { tagName: 'INPUT' } as unknown as EventTarget;
    expect(keyAction({ key: '1', target: input })).toBeNull();
    expect(keyAction({ key: 'Escape', target: input })).toEqual({ type: 'escape' });
  });
});
