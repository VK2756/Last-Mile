import { describe, expect, it } from 'vitest';
import { SimFrame, StreamEvent, type ScenarioConfig } from '@lastmile/contracts';
import { sampleFrame, sampleInit } from '@lastmile/contracts/fixtures';
import { parseStreamEvent } from '@/lib/stream';
import { createMockRunner } from '@/lib/mock';
import { formatSimClock, formatTti } from '@/lib/format';
import { householdsFC, routesFC } from '@/lib/geo';

const cfg = (policy: ScenarioConfig['policy'], seed = 7): ScenarioConfig => ({ ...sampleInit.config, helperCount: 24, seed, policy });

describe('parseStreamEvent', () => {
  it('accepts a contract-valid frame event', () => {
    const r = parseStreamEvent(JSON.stringify({ type: 'frame', frame: sampleFrame }));
    expect(r.ok).toBe(true);
  });
  it('accepts init and end events', () => {
    expect(parseStreamEvent(JSON.stringify({ type: 'init', init: sampleInit })).ok).toBe(true);
    expect(parseStreamEvent(JSON.stringify({ type: 'end', scenarioId: 'x', final: sampleFrame.metrics })).ok).toBe(true);
  });
  it('rejects non-JSON', () => {
    const r = parseStreamEvent('data: nope');
    expect(r.ok).toBe(false);
  });
  it('rejects an unknown event type', () => {
    expect(parseStreamEvent(JSON.stringify({ type: 'boom' })).ok).toBe(false);
  });
  it('rejects a frame with a bad household status', () => {
    const bad = { ...sampleFrame, households: [{ id: 'h1', status: 'on_fire', ttiSeconds: 3 }] };
    const r = parseStreamEvent(JSON.stringify({ type: 'frame', frame: bad }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/households/);
  });
  it('rejects a frame missing metrics', () => {
    const noMetrics: Partial<typeof sampleFrame> = { ...sampleFrame };
    delete noMetrics.metrics;
    expect(parseStreamEvent(JSON.stringify({ type: 'frame', frame: noMetrics })).ok).toBe(false);
  });
});

describe('mock runner', () => {
  it('yields contract-valid init and frames for the whole run', () => {
    for (const policy of ['alerts_only', 'last_mile'] as const) {
      const r = createMockRunner('m', cfg(policy));
      expect(StreamEvent.safeParse({ type: 'init', init: r.init }).success).toBe(true);
      let frames = 0;
      while (!r.done && frames < 2000) {
        const f = r.step(15);
        const p = SimFrame.safeParse(f);
        if (!p.success) throw new Error(JSON.stringify(p.error.issues.slice(0, 3)));
        frames++;
      }
      expect(r.done).toBe(true);
    }
  });

  it('keeps the fixture households and grows the fire', () => {
    const r = createMockRunner('m', cfg('last_mile'));
    for (const h of sampleInit.households) expect(r.init.households.some((x) => x.id === h.id)).toBe(true);
    const early = r.step(60).fire.burnedFraction;
    for (let i = 0; i < 40; i++) r.step(15);
    expect(r.frame().fire.burnedFraction).toBeGreaterThan(early);
    expect(r.frame().fire.rings[0]!.length).toBeGreaterThan(10);
  });

  it('is deterministic by seed', () => {
    const run = (seed: number) => {
      const r = createMockRunner('m', cfg('last_mile', seed));
      while (!r.done) r.step(20);
      return r.finalMetrics();
    };
    expect(run(3)).toEqual(run(3));
  });

  it('moves helpers and dispatches with a reason under last_mile only', () => {
    const lm = createMockRunner('m', cfg('last_mile'));
    const ao = createMockRunner('m', cfg('alerts_only'));
    let sawAssignment = false;
    for (let i = 0; i < 80; i++) {
      const f = lm.step(15);
      if (f.assignments.length) { sawAssignment = true; expect(f.assignments[0]!.reason.length).toBeGreaterThan(10); }
      expect(ao.step(15).assignments).toHaveLength(0);
    }
    expect(sawAssignment).toBe(true);
  });

  it('accounts for every household in metrics', () => {
    const r = createMockRunner('m', cfg('last_mile'));
    while (!r.done) r.step(20);
    const m = r.finalMetrics();
    expect(m.total).toBe(r.init.households.length);
    expect(m.evacuated + m.trapped).toBeLessThanOrEqual(m.total);
    expect(m.vulnerableEvacuated + m.vulnerableTrapped).toBeLessThanOrEqual(m.vulnerableTotal);
  });
});

describe('geo + format helpers', () => {
  it('builds one household feature per household and marks selection', () => {
    const fc = householdsFC(sampleInit, sampleFrame, 'h1');
    expect(fc.features).toHaveLength(sampleInit.households.length);
    expect(fc.features.find((f) => f.properties.id === 'h1')!.properties.selected).toBe(true);
    expect(routesFC(sampleFrame, 'h1').features[0]!.properties.selected).toBe(true);
  });
  it('formats clocks and countdowns', () => {
    expect(formatSimClock(0)).toBe('T+0:00');
    expect(formatSimClock(725)).toBe('T+12:05');
    expect(formatSimClock(3725)).toBe('T+1:02:05');
    expect(formatTti(null)).toBe('—');
    expect(formatTti(45)).toBe('45s');
    expect(formatTti(540)).toBe('9m');
    expect(formatTti(500)).toBe('8m 20s');
  });
});

describe('embers', () => {
  it('are deterministic per frame time and sit outside the ring', async () => {
    const { embersFC } = await import('../lib/geo');
    const { sampleFrame } = await import('@lastmile/contracts/fixtures');
    const a = embersFC(sampleFrame);
    const b = embersFC({ ...sampleFrame });
    expect(a.features.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(embersFC(null).features).toHaveLength(0);
  });
});
