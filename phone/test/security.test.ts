import { describe, expect, it } from 'vitest';
import { allowedNumbers, CallGuard, maskPhone, secretMatches } from '../src/security';

const allowed = '+15551234567';
describe('outbound call guard', () => {
  it('accepts only valid registered E.164 numbers and masks logs', () => {
    expect(allowedNumbers('bad,' + allowed + ',+0123')).toEqual(new Set([allowed]));
    expect(maskPhone(allowed)).not.toContain(allowed);
    expect(secretMatches('same', 'same')).toBe(true);
    expect(secretMatches('wrong', 'same')).toBe(false);
    const guard = new CallGuard('test-secret', allowedNumbers(allowed));
    expect(guard.reserve('+15550000000')).toBe('forbidden');
  });
  it('allows at most three calls per hour and one active call', () => {
    let now = 0;
    const guard = new CallGuard('test-secret', allowedNumbers(allowed + ',+15557654321'), () => now);
    for (let i = 0; i < 3; i++) {
      expect(guard.reserve(allowed)).toBe('allowed');
      expect(guard.reserve(allowed)).toBe('active');
      expect(guard.reserve('+15557654321')).toBe('active');
      guard.release(allowed);
    }
    expect(guard.reserve(allowed)).toBe('rate');
    now += 3_600_000;
    expect(guard.reserve(allowed)).toBe('allowed');
  });
  it('accepts a signed stream token only once and only for the bound call SID', () => {
    const guard = new CallGuard('test-secret', allowedNumbers(allowed));
    const token = guard.issue(allowed);
    guard.bind(token, 'CA123');
    expect(guard.consume(token.slice(0, -1) + 'x', 'CA123')).toBeNull();
    expect(guard.consume(token, 'CAwrong')).toBeNull();
    expect(guard.consume(token, 'CA123')).toBe(allowed);
    expect(guard.consume(token, 'CA123')).toBeNull();
  });
  it('rejects expired tokens', () => {
    let now = 0;
    const guard = new CallGuard('test-secret', allowedNumbers(allowed), () => now);
    const token = guard.issue(allowed);
    now = 60_001;
    expect(guard.consume(token, 'CA123')).toBeNull();
  });
});
