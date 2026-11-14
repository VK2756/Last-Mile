import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import pg from 'pg';
import { sampleInit } from '../../../packages/contracts/src/fixtures';
import { nearestHelpers } from '../src/index';
import { migrationStatements } from '../src/migrate';

const output = fileURLToPath(new URL('../../../docs/submission/evidence/data-live.md', import.meta.url));
const collections = ['households', 'helpers', 'scenarios', 'triage_calls'] as const;
const tables = ['risk_samples', 'dispatch_events', 'outcomes'] as const;
const aggregates = ['risk_1m', 'dispatch_1m'] as const;

async function atlasEvidence(): Promise<string[]> {
  if (!process.env.MONGODB_URI) return ['Atlas: not configured'];
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'lastmile');
    await db.command({ ping: 1 });
    const lines = ['Atlas: PASS', ''];
    for (const name of collections) {
      const count = await db.collection(name).countDocuments();
      lines.push(`- ${name}: ${count} documents`);
    }
    const matches = await nearestHelpers(sampleInit.households[0].position, {
      scenarioId: sampleInit.scenarioId, limit: 5,
    });
    lines.push(`- $geoNear fixture query: PASS (${matches.length} matches)`);
    return lines;
  } catch {
    return ['Atlas: FAIL (connection or query failed; no credential details recorded)'];
  } finally {
    await client.close();
  }
}

async function tigerEvidence(): Promise<string[]> {
  if (!process.env.TIGER_DATABASE_URL) return ['Tiger Data: not configured', 'Compression ratio: not configured'];
  const pool = new pg.Pool({ connectionString: process.env.TIGER_DATABASE_URL, connectionTimeoutMillis: 8000 });
  try {
    const lines = ['Tiger Data: PASS', ''];
    for (const table of tables) {
      const result = await pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
      lines.push(`- ${table}: ${result.rows[0].count} rows`);
    }
    lines.push('');
    for (const aggregate of aggregates) {
      const result = await pool.query<{ count: string; definition: string }>(
        `SELECT (SELECT count(*)::text FROM ${aggregate}) AS count, pg_get_viewdef('${aggregate}'::regclass, true) AS definition`,
      );
      lines.push(`- ${aggregate}: ${result.rows[0].count} rows`, '', `### ${aggregate} SQL`, '', '```sql', result.rows[0].definition.trim().replace(/;?$/, ';'), '```', '');
    }
    try {
      const stats = await pool.query<{ before: string | null; after: string | null }>(
        `SELECT sum(before_compression_total_bytes)::text AS before, sum(after_compression_total_bytes)::text AS after
         FROM (SELECT before_compression_total_bytes, after_compression_total_bytes FROM hypertable_compression_stats('risk_samples')
               UNION ALL SELECT before_compression_total_bytes, after_compression_total_bytes FROM hypertable_compression_stats('dispatch_events')
               UNION ALL SELECT before_compression_total_bytes, after_compression_total_bytes FROM hypertable_compression_stats('outcomes')) AS s`,
      );
      const before = Number(stats.rows[0].before ?? 0);
      const after = Number(stats.rows[0].after ?? 0);
      lines.push(after > 0 ? `Compression ratio: ${(before / after).toFixed(2)}:1 (${before} to ${after} bytes)` : 'Compression ratio: no compressed chunks yet');
    } catch {
      lines.push('Compression ratio: unavailable from this Tiger instance');
    }
    return lines;
  } catch {
    return ['Tiger Data: FAIL (connection or query failed; no credential details recorded)', 'Compression ratio: unavailable'];
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const [atlas, tiger] = await Promise.all([atlasEvidence(), tigerEvidence()]);
  const document = [
    '# Live data evidence',
    '',
    `Captured: ${new Date().toISOString()}`,
    '',
    'Counts include the synthetic seed fixture and any real engine runs. A count alone does not prove a real run.',
    '',
    '## Atlas',
    '',
    ...atlas,
    '',
    '### Matching query',
    '',
    'The live query uses the `helpers.location` 2dsphere index. Coordinates below are parameters, not a recorded resident location.',
    '',
    '```javascript',
    'db.helpers.aggregate([',
    '  { $geoNear: { near: { type: "Point", coordinates: [longitude, latitude] },',
    '    key: "location", distanceField: "distanceMeters", spherical: true,',
    '    query: { scenarioId, capacity: { $gte: minCapacity }, wheelchairCapable: true } } },',
    '  { $limit: 5 }',
    ']);',
    '```',
    '',
    'The wheelchair filter is included only when requested. Source: `packages/data/src/index.ts`.',
    '',
    '## Tiger Data',
    '',
    ...tiger,
    '',
    '### Continuous-aggregate migration SQL',
    '',
    'The statements below are the checked-in migration definition. The live view definitions above appear only after a successful Tiger connection.',
    '',
    '```sql',
    ...migrationStatements.filter((statement) => statement.startsWith('CREATE MATERIALIZED VIEW')).map((statement) => `${statement};`),
    '```',
    '',
  ].join('\n');
  await writeFile(output, document, 'utf8');
  for (const line of [...atlas, ...tiger]) if (line.includes(': PASS') || line.includes(': FAIL') || line.includes('not configured') || /: \d+ (documents|rows)/.test(line) || line.startsWith('Compression ratio:')) console.log(line);
  if (atlas.some((line) => line.includes('FAIL')) || tiger.some((line) => line.includes('FAIL'))) process.exitCode = 1;
}

main().catch(() => { console.error('Evidence generation: FAIL'); process.exitCode = 1; });
