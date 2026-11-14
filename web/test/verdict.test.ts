import { describe, expect, it } from 'vitest';
import type { Metrics } from '@lastmile/contracts';
import { verdict } from '../lib/verdict';

const m = (vulnerableEvacuated: number, trapped: number): Metrics => ({ total: 100, evacuated: 80, trapped, inProgress: 0, vulnerableTotal: 30, vulnerableEvacuated, vulnerableTrapped: 0 });

describe('end-of-run verdict', () => {
  it('names the policy that got more vulnerable households out', () => {
    const v = verdict(m(10, 20), m(25, 8));
    expect(v.winner).toBe('last_mile');
    expect(v.vulnerableDelta).toBe(15);
    expect(v.headline).toBe('Last Mile got 15 more vulnerable households out');
    expect(v.detail).toContain('25 vs 10 of 30');
    expect(v.detail).toContain('12 households fewer trapped');
  });
  it('is honest when the baseline wins or it is a tie', () => {
    expect(verdict(m(20, 5), m(18, 5)).winner).toBe('alerts_only');
    expect(verdict(m(20, 5), m(18, 5)).headline).toContain('Alerts only');
    expect(verdict(m(20, 5), m(20, 5)).winner).toBeNull();
    expect(verdict(m(20, 9), m(20, 5)).winner).toBe('last_mile');
  });
});
