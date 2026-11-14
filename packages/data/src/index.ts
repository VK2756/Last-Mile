import { MongoClient, type Document } from 'mongodb';
import pg from 'pg';
import type { DataSink, DispatchEvent, Helper, Household, OutcomeRecord, RiskSample, LatLng, SimInit, TriageResult } from '@lastmile/contracts';
import { createMemorySink } from '@lastmile/contracts';

export type FlushableDataSink = DataSink & { flush(): Promise<void> };

/** No credentials means a deterministic, usable sink for CI and local development. */
export function createDataSink(): FlushableDataSink {
  const mongoUri = process.env.MONGODB_URI;
  const tigerUri = process.env.TIGER_DATABASE_URL;
  if (!mongoUri || !tigerUri) {
    const memory = createMemorySink();
    return { ...memory, async flush() {} };
  }
  return createBufferedSink(mongoUri, tigerUri);
}

function createBufferedSink(mongoUri: string, tigerUri: string): FlushableDataSink {
  const mongo = new MongoClient(mongoUri);
  const sql = new pg.Pool({ connectionString: tigerUri, max: 4 });
  const db = mongo.db(process.env.MONGODB_DB || 'lastmile');
  let risk: RiskSample[] = [];
  let dispatch: DispatchEvent[] = [];
  let outcomes: OutcomeRecord[] = [];
  let pending: Promise<void> = Promise.resolve();
  const flush = async (): Promise<void> => {
    const risks = risk.splice(0);
    const events = dispatch.splice(0);
    const finals = outcomes.splice(0);
    if (!risks.length && !events.length && !finals.length) return pending;
    pending = pending.then(async () => {
      try {
        const values: unknown[] = [];
        const tuples = risks.map((r) => {
          values.push(r.scenarioId, r.policy, r.t, r.householdId, r.ttiSeconds, r.status);
          const n = values.length;
          return `($${n - 5},$${n - 4},$${n - 3},$${n - 2},$${n - 1},$${n})`;
        });
        if (tuples.length) await sql.query(`INSERT INTO risk_samples (scenario_id, policy, sim_t, household_id, tti_seconds, status) VALUES ${tuples.join(',')}`, values);
        for (const e of events) await sql.query(
          'INSERT INTO dispatch_events (scenario_id, policy, sim_t, assignment_id, helper_id, household_ids, eta_seconds, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [e.scenarioId, e.policy, e.t, e.assignmentId, e.helperId, e.householdIds, e.etaSeconds, e.reason]);
        for (const o of finals) await sql.query(
          'INSERT INTO outcomes (scenario_id, policy, seed, metrics) VALUES ($1,$2,$3,$4)',
          [o.scenarioId, o.policy, o.seed, JSON.stringify(o.metrics)]);
        if (finals.length) await db.collection('scenarios').bulkWrite(finals.map((o) => ({ updateOne: {
          filter: { scenarioId: o.scenarioId }, update: { $set: { scenarioId: o.scenarioId, policy: o.policy, seed: o.seed, metrics: o.metrics } }, upsert: true,
        } })));
      } catch (error) {
        // The simulation must continue if an external database is unavailable.
        console.error('[data] write failed; dropping buffered records', error);
      }
    });
    return pending;
  };
  const timer = setInterval(() => { void flush(); }, 1000);
  timer.unref();
  return {
    async recordRisk(samples) { risk.push(...samples); if (risk.length >= 500) await flush(); },
    async recordDispatch(event) { dispatch.push(event); if (dispatch.length >= 500) await flush(); },
    async recordOutcome(outcome) { outcomes.push(outcome); if (outcomes.length >= 500) await flush(); },
    flush,
  };
}

export async function ensureAtlasCollections(client: MongoClient, database = process.env.MONGODB_DB || 'lastmile'): Promise<void> {
  const db = client.db(database);
  for (const name of ['households', 'helpers', 'scenarios', 'triage_calls']) {
    const existing = await db.listCollections({ name }, { nameOnly: true }).toArray();
    if (!existing.length) await db.createCollection(name);
  }
  await db.collection('households').createIndex({ scenarioId: 1, id: 1 }, { unique: true });
  await db.collection('helpers').createIndex({ location: '2dsphere' });
  await db.collection('helpers').createIndex({ scenarioId: 1, id: 1 }, { unique: true });
}

export function toGeoPoint(point: LatLng): { type: 'Point'; coordinates: [number, number] } {
  return { type: 'Point', coordinates: [point.lng, point.lat] };
}

export async function nearestHelpers(point: LatLng, options: { wheelchair?: boolean; minCapacity?: number; limit?: number; scenarioId?: string } = {}): Promise<(Helper & { distanceMeters: number })[]> {
  if (!process.env.MONGODB_URI) return [];
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const query: Document = { capacity: { $gte: options.minCapacity ?? 1 } };
    if (options.wheelchair) query.wheelchairCapable = true;
    if (options.scenarioId) query.scenarioId = options.scenarioId;
    const rows = await client.db(process.env.MONGODB_DB || 'lastmile').collection('helpers').aggregate<Document>([{ $geoNear: {
      near: toGeoPoint(point), key: 'location', distanceField: 'distanceMeters', spherical: true, query,
    } }, { $limit: Math.min(Math.max(options.limit ?? 5, 1), 50) }]).toArray();
    return rows.map((row) => ({ id: String(row.id), kind: row.kind as Helper['kind'], position: row.position as LatLng,
      capacity: Number(row.capacity), wheelchairCapable: Boolean(row.wheelchairCapable), distanceMeters: Number(row.distanceMeters) }));
  } finally { await client.close(); }
}

export async function riskSeries(scenarioId: string): Promise<{ t: number; status: string; households: number; minTtiSeconds: number | null }[]> {
  if (!process.env.TIGER_DATABASE_URL) return [];
  const sql = new pg.Pool({ connectionString: process.env.TIGER_DATABASE_URL });
  try {
    const result = await sql.query<{ t: number; status: string; households: string; min_tti_seconds: number | null }>(
      'SELECT sim_t AS t, status, count(*) AS households, min(tti_seconds) AS min_tti_seconds FROM risk_samples WHERE scenario_id = $1 GROUP BY sim_t, status ORDER BY sim_t', [scenarioId]);
    return result.rows.map((r) => ({ t: Number(r.t), status: r.status, households: Number(r.households), minTtiSeconds: r.min_tti_seconds == null ? null : Number(r.min_tti_seconds) }));
  } finally { await sql.end(); }
}

export function householdDocument(scenarioId: string, household: Household) {
  return { ...household, scenarioId, location: toGeoPoint(household.position) };
}
export function helperDocument(scenarioId: string, helper: Helper) {
  return { ...helper, scenarioId, location: toGeoPoint(helper.position) };
}

/** Called when a real engine scenario is created; seed() is only a demo fixture. */
export async function upsertWorld(init: SimInit): Promise<void> {
  if (!process.env.MONGODB_URI) return;
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    await ensureAtlasCollections(client);
    const db = client.db(process.env.MONGODB_DB || 'lastmile');
    if (init.households.length) await db.collection('households').bulkWrite(init.households.map((household) => ({ updateOne: {
      filter: { scenarioId: init.scenarioId, id: household.id },
      update: { $set: householdDocument(init.scenarioId, household) }, upsert: true,
    } })));
    if (init.helpers.length) await db.collection('helpers').bulkWrite(init.helpers.map((helper) => ({ updateOne: {
      filter: { scenarioId: init.scenarioId, id: helper.id },
      update: { $set: helperDocument(init.scenarioId, helper) }, upsert: true,
    } })));
    await db.collection('scenarios').updateOne({ scenarioId: init.scenarioId },
      { $set: { scenarioId: init.scenarioId, config: init.config, assumptions: init.assumptions } }, { upsert: true });
  } finally { await client.close(); }
}

export async function recordTriageCall(scenarioId: string, result: TriageResult): Promise<void> {
  if (!process.env.MONGODB_URI) return;
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    await client.db(process.env.MONGODB_DB || 'lastmile').collection('triage_calls').insertOne({ scenarioId, ...result, recordedAt: new Date() });
  } finally { await client.close(); }
}
