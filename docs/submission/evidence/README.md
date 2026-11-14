# Evidence capture (no credentials or personal data in git)

Capture only synthetic scenario data. Save redacted screenshots here after the live services exist. Record the exact scenario ID, timestamp, and command beside each capture. Do not commit URI values, tokens, or connection strings.

## Tiger Data

Run `pnpm --filter @lastmile/data migrate`, then a real engine scenario with `DATA_SINK=real`. In the Tiger SQL console, capture:

```sql
SELECT count(*) AS risk_samples FROM risk_samples;
SELECT count(*) AS dispatch_events FROM dispatch_events;
SELECT count(*) AS outcomes FROM outcomes;
SELECT * FROM risk_1m ORDER BY bucket DESC LIMIT 10;
SELECT * FROM dispatch_1m ORDER BY bucket DESC LIMIT 10;
SELECT pg_get_viewdef('risk_1m'::regclass, true);
SELECT pg_get_viewdef('dispatch_1m'::regclass, true);
```

Compression is configured to start after one day, so a fresh hackathon run may show no compressed chunks. Report that honestly and capture the configured policy instead of inventing a ratio. If older chunks exist, compare their compressed and uncompressed sizes in the Tiger console.

## MongoDB Atlas

Run `pnpm --filter @lastmile/data seed` for the fixture, then a real engine scenario. Capture document counts for `households`, `helpers`, `scenarios`, and `triage_calls`, making clear which rows are fixture data and which came from the live run. The matching query is implemented in `packages/data/src/index.ts` as `$geoNear` with a 2dsphere `location` index, wheelchair and capacity filters, and a bounded limit. Capture the query and a redacted result.

## Vultr and domain

Capture the Vultr VM dashboard, the public `https://<API_HOST>/health` response, the DNS A record for `api`, and a browser HTTPS capture. Keep public IPs only if the team approves publication.
