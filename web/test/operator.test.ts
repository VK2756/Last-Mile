import { describe, expect, it } from 'vitest';
import { sampleFrame, sampleInit } from '@lastmile/contracts/fixtures';
import { atRiskRows } from '../lib/operator';

describe('operator queue', () => {
  it('lists threatened, unresolved households by time to impact with their assignment', () => {
    const rows = atRiskRows(sampleInit, sampleFrame);
    expect(rows.map((r) => r.household.id)).toEqual(['h1', 'h3']); // h2 has ttiSeconds null
    expect(rows[0]!.assignment?.id).toBe('a1');
    expect(rows[1]!.assignment).toBeUndefined();
  });
  it('drops evacuated/trapped and can filter to vulnerable', () => {
    const frame = { ...sampleFrame, households: [
      { id: 'h1', status: 'evacuated' as const, ttiSeconds: 10 },
      { id: 'h2', status: 'warned' as const, ttiSeconds: 50 },
      { id: 'h3', status: 'needs_help' as const, ttiSeconds: 90 },
    ] };
    expect(atRiskRows(sampleInit, frame).map((r) => r.household.id)).toEqual(['h2', 'h3']);
    expect(atRiskRows(sampleInit, frame, true).map((r) => r.household.id)).toEqual(['h3']);
    expect(atRiskRows(null, frame)).toEqual([]);
  });
});
