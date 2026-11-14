import { describe, expect, it } from 'vitest';
import type { SimFrame } from '@lastmile/contracts';
import { sampleFrame } from '@lastmile/contracts/fixtures';
import { combinedStatus, frameAt, MAX_BUFFER, pushFrame, sharedTime } from '../lib/sync';

const f = (t: number): SimFrame => ({ ...sampleFrame, t });

describe('split-screen sync', () => {
  it('frameAt picks the latest frame at or before t', () => {
    const buf = [f(0), f(10), f(20), f(30)];
    expect(frameAt(buf, 25)?.t).toBe(20);
    expect(frameAt(buf, 30)?.t).toBe(30);
    expect(frameAt(buf, 99)?.t).toBe(30);
    expect(frameAt(buf, -Infinity)?.t).toBe(0);
    expect(frameAt([], 5)).toBeNull();
  });

  it('pushFrame caps the buffer and resets when time goes backwards', () => {
    const buf: SimFrame[] = [];
    for (let i = 0; i < MAX_BUFFER + 50; i++) pushFrame(buf, f(i));
    expect(buf.length).toBe(MAX_BUFFER);
    pushFrame(buf, f(3));
    expect(buf.map((x) => x.t)).toEqual([3]);
  });

  it('the slower live side sets the shared clock; ended or failed sides stop holding', () => {
    expect(sharedTime({ latestT: 40, status: 'live' }, { latestT: 30, status: 'live' })).toBe(30);
    expect(sharedTime({ latestT: 40, status: 'live' }, { latestT: 30, status: 'ended' })).toBe(40);
    expect(sharedTime({ latestT: 40, status: 'live' }, { latestT: null, status: 'error' })).toBe(40);
    expect(sharedTime({ latestT: 40, status: 'live' }, { latestT: null, status: 'connecting' })).toBe(-Infinity);
    expect(sharedTime({ latestT: 50, status: 'ended' }, { latestT: 45, status: 'ended' })).toBe(50);
    expect(sharedTime({ latestT: null, status: 'connecting' }, { latestT: null, status: 'connecting' })).toBeNull();
  });

  it('combinedStatus reports the worst side', () => {
    expect(combinedStatus('live', 'error')).toBe('error');
    expect(combinedStatus('live', 'ended')).toBe('live');
    expect(combinedStatus('ended', 'ended')).toBe('ended');
  });
});

describe('replay history', () => {
  it('keeps the first frame and then one every minDt sim-seconds', async () => {
    const { pushHistory } = await import('../lib/sync');
    const buf: SimFrame[] = [];
    for (let t = 0; t <= 20; t += 2) pushHistory(buf, f(t), 5);
    expect(buf.map((x) => x.t)).toEqual([0, 6, 12, 18]);
    pushHistory(buf, f(1), 5);
    expect(buf.map((x) => x.t)).toEqual([1]);
  });
});
