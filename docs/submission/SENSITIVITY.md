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

Vulnerable households evacuated and the paired lift with its 95% CI. Real engine, real Amherst roads, preset scenario unless noted.

| assumption changed | seeds | alerts only | Last Mile | lift |
|---|---|---|---|---|
| none (headline preset) | 200 | 45.1% | 74.5% | +29.4 pts [28.6, 30.2] |
| none, fresh seeds 1001–1200 | 200 | 44.8% | 74.4% | +29.6 pts [28.8, 30.4] |
| help requests known 5–10 min after warning (not 1–3) | 50 | 44.2% | 71.9% | +27.7 pts [26.1, 29.3] |
| helpers start far from the fire | 50 | 44.2% | 73.8% | +29.6 pts [28.1, 31.1] |
| 6 helpers instead of 24 | 200 | 45.1% | 65.2% | +20.1 pts [19.4, 20.8] |
| faster fire: 35 mph wind | 200 | 36.7% | 59.9% | +23.3 pts [22.6, 23.9] |
| 35 mph wind and 6 helpers | 200 | 36.7% | 51.7% | +15.0 pts [14.5, 15.6] |
| slow requests + 6 helpers + far start | 50 | 44.2% | 64.3% | +20.1 pts [18.7, 21.4] |
| sanity: 0 helpers | 50 | 44.2% | 44.2% | +0.0 pts [0.0, 0.0] |

Harsher assumptions cut the lift roughly in half in the worst case we ran (fast fire, few helpers) but never to zero; with no helpers the two policies are identical, as they should be. The number of helpers matters most; the request delay matters little because the fire needs about an hour to reach most homes. **Not tested:** helpers that break down, wrong or false help requests, people refusing to leave.

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

## Lane A sensitivity variants (50 paired seeds per row)

From `docs/status/lane-a.md` (#65, `engine/src/sim/sensitivityReport.ts`, real headless, preset base). Every non-default
assumption is printed in `SimInit.assumptions` with a "SENSITIVITY" marker.

| assumption set | alerts only | Last Mile | lift (pts) [95% CI] | all homes trapped (alerts -> LM) |
|---|---|---|---|---|
| headline (help known 1–3 min, 24 helpers at random nodes) | 44.2% | 74.2% | +30.0 [28.2, 31.8] | 30.4% -> 23.2% |
| help requests known 5–10 min after warning | 44.2% | 71.9% | +27.7 [26.1, 29.3] | 30.4% -> 23.7% |
| 12 helpers | 44.2% | 72.0% | +27.8 [26.4, 29.3] | 30.4% -> 23.7% |
| 6 helpers | 44.2% | 65.6% | +21.4 [19.9, 23.0] | 30.4% -> 25.2% |
| helpers start far from the fire (30% of nodes it reaches last) | 44.2% | 73.8% | +29.6 [28.1, 31.1] | 30.4% -> 23.3% |
| HARSH: 5–10 min + 12 helpers + far start | 44.2% | 68.1% | +23.9 [22.3, 25.6] | 30.4% -> 24.7% |
| HARSHEST: 5–10 min + 6 helpers + far start | 44.2% | 64.3% | +20.1 [18.7, 21.4] | 30.4% -> 25.6% |

## What would make the result weaker (to test next)

- Helpers that break down or arrive late, wrong or false help requests, people who refuse to leave.
- A stronger baseline, such as more family pickups or earlier self-evacuation: see `docs/submission/BASELINE_REVIEW.md` once it exists.
- Other towns (`paradise_like`, `synthetic_grid`): `--town` flag; road data quality differs.

## Earlier numbers (for the record)

Lane D's status (before #61's cadence change) reported the preset lift as +27.4 pts [26.6, 28.2] and fast fire + 6 helpers
as +14.7 pts [14.1, 15.2]. The numbers above supersede them for anything we publish.
