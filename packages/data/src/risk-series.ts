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
