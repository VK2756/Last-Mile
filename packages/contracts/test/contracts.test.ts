import { describe, it, expect } from 'vitest';
import { SimInit, SimFrame, StreamEvent, TriageResult, isVulnerable, createMemorySink } from '../src/index';
import { sampleInit, sampleFrame } from '../src/fixtures';

describe('contracts', () => {
  it('fixtures satisfy the schemas', () => {
    expect(SimInit.safeParse(sampleInit).success).toBe(true);
    expect(SimFrame.safeParse(sampleFrame).success).toBe(true);
  });
  it('stream events discriminate', () => {
    expect(StreamEvent.safeParse({ type: 'frame', frame: sampleFrame }).success).toBe(true);
    expect(StreamEvent.safeParse({ type: 'nope' }).success).toBe(false);
  });
  it('vulnerability definition is shared', () => {
    expect(isVulnerable({ needs: [], hasVehicle: false })).toBe(true);
    expect(isVulnerable({ needs: ['pets'], hasVehicle: true })).toBe(false);
    expect(isVulnerable({ needs: ['oxygen'], hasVehicle: true })).toBe(true);
  });
  it('triage result rejects bad urgency', () => {
    const base = { householdId: 'h1', needs: [], hasRide: null, canWalkToRoad: null, residents: null, reply: '', summary: '', done: false };
    expect(TriageResult.safeParse({ ...base, urgency: 3 }).success).toBe(true);
    expect(TriageResult.safeParse({ ...base, urgency: 9 }).success).toBe(false);
  });
  it('memory sink records', async () => {
    const s = createMemorySink();
    await s.recordOutcome({ scenarioId: 'x', policy: 'last_mile', seed: 1, metrics: sampleFrame.metrics });
    expect(s.outcomes.length).toBe(1);
  });
});
