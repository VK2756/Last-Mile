import { describe, it, expect } from 'vitest';
import { ScenarioConfig, SimInit, SimFrame, StreamEvent, TriageResult, isVulnerable, createMemorySink } from '../src/index';
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

describe('optional fleet and baseline knobs (additive)', () => {
  const base = { seed: 1, wind: { speedMph: 10, dirDeg: 90 }, ignition: { lat: 42.37, lng: -72.52 }, policy: 'last_mile' as const };
  it('a config without knobs parses exactly as before (no knob keys appear)', () => {
    const c = ScenarioConfig.parse(base);
    expect(c).not.toHaveProperty('helperMix'); expect(c).not.toHaveProperty('helperCapacityScale'); expect(c).not.toHaveProperty('baseline');
  });
  it('accepts valid knobs and rejects nonsense', () => {
    expect(ScenarioConfig.parse({ ...base, helperMix: { neighbor: 1 }, helperCapacityScale: 0.5, baseline: { familyPickupProb: 0.5, urgentFamilyPickup: true, neighborRideProb: 0.3 } }).baseline?.neighborRideProb).toBe(0.3);
    expect(ScenarioConfig.safeParse({ ...base, helperMix: {} }).success).toBe(false);
    expect(ScenarioConfig.safeParse({ ...base, baseline: { familyPickupProb: 2 } }).success).toBe(false);
  });
});
