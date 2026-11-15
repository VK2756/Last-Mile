# Live data evidence

Captured: 2026-11-15T07:05:46.999Z

Counts include the synthetic seed fixture and any real engine runs. A count alone does not prove a real run.

## Atlas

Atlas: PASS

- households: 603 documents
- helpers: 26 documents
- scenarios: 2 documents
- triage_calls: 0 documents
- $geoNear fixture query: PASS (2 matches)

### Matching query

The live query uses the `helpers.location` 2dsphere index. Coordinates below are parameters, not a recorded resident location.

```javascript
db.helpers.aggregate([
  { $geoNear: { near: { type: "Point", coordinates: [longitude, latitude] },
    key: "location", distanceField: "distanceMeters", spherical: true,
    query: { scenarioId, capacity: { $gte: minCapacity }, wheelchairCapable: true } } },
  { $limit: 5 }
]);
```

The wheelchair filter is included only when requested. Source: `packages/data/src/index.ts`.

## Tiger Data

Tiger Data: PASS

- risk_samples: 17540 rows
- dispatch_events: 112 rows
- outcomes: 0 rows

- risk_1m: 9 rows

### risk_1m SQL

```sql
SELECT bucket,
    scenario_id,
    policy,
    status,
    households,
    min_tti_seconds
   FROM _timescaledb_internal._materialized_hypertable_4;
```

- dispatch_1m: 1 rows

### dispatch_1m SQL

```sql
SELECT bucket,
    scenario_id,
    policy,
    assignments,
    mean_eta_seconds
   FROM _timescaledb_internal._materialized_hypertable_5;
```

Compression ratio: no compressed chunks yet

### Continuous-aggregate migration SQL

The statements below are the checked-in migration definition. The live view definitions above appear only after a successful Tiger connection.

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS risk_1m WITH (timescaledb.continuous) AS
    SELECT time_bucket('1 minute', recorded_at) AS bucket, scenario_id, policy, status,
      count(*) AS households, min(tti_seconds) AS min_tti_seconds
    FROM risk_samples GROUP BY bucket, scenario_id, policy, status WITH NO DATA;
CREATE MATERIALIZED VIEW IF NOT EXISTS dispatch_1m WITH (timescaledb.continuous) AS
    SELECT time_bucket('1 minute', recorded_at) AS bucket, scenario_id, policy,
      count(*) AS assignments, avg(eta_seconds) AS mean_eta_seconds
    FROM dispatch_events GROUP BY bucket, scenario_id, policy WITH NO DATA;
```
