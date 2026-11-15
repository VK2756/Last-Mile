import pg from 'pg';

export async function riskSeries(scenarioId: string): Promise<{ t: number; status: string; households: number; minTtiSeconds: number | null }[]> {
  if (!process.env.TIGER_DATABASE_URL) return [];
  const sql = new pg.Pool({ connectionString: process.env.TIGER_DATABASE_URL });
  try {
    const result = await sql.query<{ t: number; status: string; households: string; min_tti_seconds: number | null }>(
      'SELECT sim_t AS t, status, count(*) AS households, min(tti_seconds) AS min_tti_seconds FROM risk_samples WHERE scenario_id = $1 GROUP BY sim_t, status ORDER BY sim_t', [scenarioId]);
    return result.rows.map((r) => ({ t: Number(r.t), status: r.status, households: Number(r.households), minTtiSeconds: r.min_tti_seconds == null ? null : Number(r.min_tti_seconds) }));
  } finally { await sql.end(); }
}

/** New helper assignments by simulated minute, not wall-clock recording minute. */
export async function dispatchSeries(scenarioId: string): Promise<{ minute: number; dispatches: number }[]> {
  if (!process.env.TIGER_DATABASE_URL) return [];
  const sql = new pg.Pool({ connectionString: process.env.TIGER_DATABASE_URL });
  try {
    const result = await sql.query<{ minute: number; dispatches: string }>(
      `SELECT floor(sim_t / 60)::integer AS minute, count(DISTINCT assignment_id) AS dispatches
       FROM dispatch_events WHERE scenario_id = $1 AND policy = 'last_mile'
       GROUP BY minute ORDER BY minute`, [scenarioId]);
    return result.rows.map((row) => ({ minute: Number(row.minute), dispatches: Number(row.dispatches) }));
  } finally { await sql.end(); }
}
