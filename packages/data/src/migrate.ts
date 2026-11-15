import { pathToFileURL } from 'node:url';
import pg from 'pg';

export const migrationStatements = [
  'CREATE EXTENSION IF NOT EXISTS timescaledb',
  `CREATE TABLE IF NOT EXISTS risk_samples (
    recorded_at timestamptz NOT NULL DEFAULT now(), scenario_id text NOT NULL, policy text NOT NULL,
    sim_t double precision NOT NULL, household_id text NOT NULL, tti_seconds double precision, status text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS dispatch_events (
    recorded_at timestamptz NOT NULL DEFAULT now(), scenario_id text NOT NULL, policy text NOT NULL,
    sim_t double precision NOT NULL, assignment_id text NOT NULL, helper_id text NOT NULL,
    household_ids text[] NOT NULL, eta_seconds double precision NOT NULL, reason text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS outcomes (
    recorded_at timestamptz NOT NULL DEFAULT now(), scenario_id text NOT NULL, policy text NOT NULL,
    seed integer NOT NULL, metrics jsonb NOT NULL)`,
  `SELECT create_hypertable('risk_samples', 'recorded_at', if_not_exists => TRUE)`,
  `SELECT create_hypertable('dispatch_events', 'recorded_at', if_not_exists => TRUE)`,
  `SELECT create_hypertable('outcomes', 'recorded_at', if_not_exists => TRUE)`,
  `CREATE INDEX IF NOT EXISTS risk_samples_scenario_t ON risk_samples (scenario_id, sim_t)`,
  `CREATE INDEX IF NOT EXISTS dispatch_events_scenario_t ON dispatch_events (scenario_id, sim_t)`,
  `CREATE MATERIALIZED VIEW IF NOT EXISTS risk_1m WITH (timescaledb.continuous) AS
    SELECT time_bucket('1 minute', recorded_at) AS bucket, scenario_id, policy, status,
      count(*) AS households, min(tti_seconds) AS min_tti_seconds
    FROM risk_samples GROUP BY bucket, scenario_id, policy, status WITH NO DATA`,
  `CREATE MATERIALIZED VIEW IF NOT EXISTS dispatch_1m WITH (timescaledb.continuous) AS
    SELECT time_bucket('1 minute', recorded_at) AS bucket, scenario_id, policy,
      count(*) AS assignments, avg(eta_seconds) AS mean_eta_seconds
    FROM dispatch_events GROUP BY bucket, scenario_id, policy WITH NO DATA`,
  `ALTER TABLE risk_samples SET (timescaledb.compress, timescaledb.compress_segmentby = 'scenario_id,policy')`,
  `ALTER TABLE dispatch_events SET (timescaledb.compress, timescaledb.compress_segmentby = 'scenario_id,policy')`,
  `ALTER TABLE outcomes SET (timescaledb.compress, timescaledb.compress_segmentby = 'scenario_id,policy')`,
  `SELECT add_compression_policy('risk_samples', INTERVAL '1 day', if_not_exists => TRUE)`,
  `SELECT add_compression_policy('dispatch_events', INTERVAL '1 day', if_not_exists => TRUE)`,
  `SELECT add_compression_policy('outcomes', INTERVAL '1 day', if_not_exists => TRUE)`,
  `SELECT add_continuous_aggregate_policy('risk_1m', start_offset => INTERVAL '1 day', end_offset => INTERVAL '1 minute', schedule_interval => INTERVAL '1 minute', if_not_exists => TRUE)`,
  `SELECT add_continuous_aggregate_policy('dispatch_1m', start_offset => INTERVAL '1 day', end_offset => INTERVAL '1 minute', schedule_interval => INTERVAL '1 minute', if_not_exists => TRUE)`,
];

export async function migrate(connectionString = process.env.TIGER_DATABASE_URL): Promise<void> {
  if (!connectionString) throw new Error('TIGER_DATABASE_URL is required for migration');
  const pool = new pg.Pool({ connectionString });
  try {
    // Continuous aggregates must be created outside an explicit transaction.
    for (const statement of migrationStatements) await pool.query(statement);
  } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().then(() => console.log('Tiger migration complete')).catch((error) => { console.error(error); process.exitCode = 1; });
}
