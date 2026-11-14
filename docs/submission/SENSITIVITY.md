# Sensitivity: how the result holds up under harsher assumptions

Everything here is a **simulation with synthetic people**. Numbers come only from the real Monte Carlo evaluator
(`engine/src/montecarlo`, Lane D) running the real engine headless; nothing is hand-entered or tuned. Raw outputs are in
`docs/submission/sensitivity/*.json` (each file also carries the full assumptions list).

**Provenance:** main @ `e9080ee` (after #61: real Amherst OSM roads, re-plan cadence 6/20 s), run Sat 14 Nov 2026 on a 12-core Mac.
Refresh (from `engine/`):

```
pnpm exec tsx scripts/montecarlo-cli.ts --json [--seed-start N] [--wind-mph X --wind-dir D] [--helpers K] [--runs R]
```

## On the results page

Vulnerable households evacuated, mean over 200 paired seeds, with the paired lift and its 95% CI (real engine, main @ `e9080ee`):

| scenario | alerts only | Last Mile | lift |
|---|---|---|---|
| preset: 20 mph wind, 24 helpers | 45.1% | 74.5% | +29.4 pts [28.6, 30.2] |
| fresh seeds 1001–1200 (replication) | 44.8% | 74.4% | +29.6 pts [28.8, 30.4] |
| faster fire: 35 mph | 36.7% | 59.9% | +23.3 pts [22.6, 23.9] |
| fewer helpers: 6 instead of 24 | 45.1% | 65.2% | +20.1 pts [19.4, 20.8] |
| both: 35 mph and 6 helpers | 36.7% | 51.7% | +15.0 pts [14.5, 15.6] |
| sanity: 0 helpers (50 seeds) | 44.2% | 44.2% | +0.0 pts [0.0, 0.0] |

The lift shrinks by about half when the fire is faster and helpers are scarce, but stays above zero in every case we ran.
With no helpers the two policies are identical, as they should be. **Not yet varied:** how quickly help requests reach
dispatch (assumed 1 to 3 min after the warning) and where helpers start (random road nodes); both are listed assumptions.

## Full table (200 paired seeds unless noted)

| scenario | seeds | alerts only: vulnerable | Last Mile: vulnerable | lift (pts) | alerts only: all homes | Last Mile: all homes | wall time |
|---|---|---|---|---|---|---|---|
| preset (20 mph toward 90°, 24 helpers) | 1–200 | 45.1% [44.2, 45.9] | 74.5% [73.6, 75.3] | +29.4 [28.6, 30.2] | 69.7% [69.3, 70.1] | 76.7% [76.3, 77.1] | 13.9 s |
| preset, fresh seeds | 1001–1200 | 44.8% [43.9, 45.8] | 74.4% [73.6, 75.2] | +29.6 [28.8, 30.4] | 69.5% [69.1, 69.9] | 76.5% [76.1, 76.9] | 14.1 s |
| faster fire (35 mph toward 45°) | 1–200 | 36.7% [35.9, 37.4] | 59.9% [59.1, 60.7] | +23.3 [22.6, 23.9] | 57.6% [57.2, 58.0] | 63.1% [62.7, 63.5] | 12.4 s |
| fewer helpers (6) | 1–200 | 45.1% [44.2, 45.9] | 65.2% [64.2, 66.2] | +20.1 [19.4, 20.8] | 69.7% [69.3, 70.1] | 74.5% [74.1, 74.9] | 16.7 s |
| faster fire + fewer helpers | 1–200 | 36.7% [35.9, 37.4] | 51.7% [50.9, 52.6] | +15.0 [14.5, 15.6] | 57.6% [57.2, 58.0] | 61.1% [60.7, 61.5] | 13.4 s |
| zero helpers (sanity) | 1–50 | 44.2% [42.6, 45.8] | 44.2% [42.6, 45.8] | +0.0 [0.0, 0.0] | 69.6% [68.7, 70.5] | 69.6% [68.7, 70.5] | 2.1 s |

Intervals are percentile bootstrap 95% intervals over runs (2,000 resamples). "Vulnerable" = no vehicle, or wheelchair,
oxygen, dementia, medical device or vision impaired (single definition in `packages/contracts`). Rates count only
households the fire reaches within 2 hours.

## What would make the result weaker (to test next)

- Slower help requests (for example 5 to 10 min instead of 1 to 3 min): needs an engine parameter (Lane A).
- Helpers starting far from the fire, or arriving late: needs an engine parameter (Lane A / D).
- A stronger baseline, such as more family pickups or earlier self-evacuation: see `docs/submission/BASELINE_REVIEW.md` once it exists.
- Other towns (`paradise_like`, `synthetic_grid`): `--town` flag; road data quality differs.

## Earlier numbers (for the record)

Lane D's status (before #61's cadence change) reported the preset lift as +27.4 pts [26.6, 28.2] and fast fire + 6 helpers
as +14.7 pts [14.1, 15.2]. The numbers above supersede them for anything we publish.
