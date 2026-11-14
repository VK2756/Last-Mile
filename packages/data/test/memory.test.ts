import { afterEach, describe, expect, it } from 'vitest';
import { createDataSink, toGeoPoint } from '../src/index';

const originalMongo = process.env.MONGODB_URI;
const originalTiger = process.env.TIGER_DATABASE_URL;
afterEach(() => { process.env.MONGODB_URI = originalMongo; process.env.TIGER_DATABASE_URL = originalTiger; });

describe('credential-free data sink', () => {
  it('records data and flushes without external services', async () => {
    delete process.env.MONGODB_URI;
    delete process.env.TIGER_DATABASE_URL;
    const sink = createDataSink();
    await sink.recordRisk([{ scenarioId: 's', policy: 'last_mile', t: 1, householdId: 'h', ttiSeconds: 4, status: 'needs_help' }]);
    await sink.recordDispatch({ scenarioId: 's', policy: 'last_mile', t: 1, assignmentId: 'a', helperId: 'p', householdIds: ['h'], etaSeconds: 3, reason: 'test' });
    await sink.recordOutcome({ scenarioId: 's', policy: 'last_mile', seed: 1, metrics: { total: 1, evacuated: 1, trapped: 0, inProgress: 0, vulnerableTotal: 1, vulnerableEvacuated: 1, vulnerableTrapped: 0 } });
    await sink.flush();
    expect('risk' in sink && sink.risk).toHaveLength(1);
    expect('dispatches' in sink && sink.dispatches).toHaveLength(1);
    expect('outcomes' in sink && sink.outcomes).toHaveLength(1);
  });
  it('uses GeoJSON longitude, latitude order', () => {
    expect(toGeoPoint({ lat: 42, lng: -72 }).coordinates).toEqual([-72, 42]);
  });
});
