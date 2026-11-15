# Sensitivity: how the result holds up under harsher assumptions

Everything here is a **simulation with synthetic people**. Numbers come only from the real Monte Carlo evaluator
(`engine/src/montecarlo`, Lane D) running the real engine headless; nothing is hand-entered or tuned. Raw outputs are in
`docs/submission/sensitivity/*.json` (each file also carries the full assumptions list).

**Provenance:** main @ `47c452c` (real Amherst OSM roads, after #61/#65/#66/#86; defaults unchanged), run Sat 14 Nov 2026 ~15:40 EST on a 12-core Mac.
The 200-seed rows match the earlier run on `e9080ee` exactly. Generated summary: [`NUMBERS.md`](NUMBERS.md).
Refresh (from `engine/`):

```
pnpm exec tsx scripts/montecarlo-cli.ts --json [--seed-start N] [--wind-mph X --wind-dir D] [--helpers K] [--runs R]
```

## On the results page

Vulnerable households evacuated and the paired lift with its 95% CI. Real engine on real Amherst roads (main @ `47c452c`).

| assumption changed | seeds | alerts only | Last Mile | lift |
|---|---|---|---|---|
| none (headline preset) | 200 | 45.1% | 74.5% | +29.4 pts [28.6, 30.2] |
| none, fresh seeds 1001–1200 | 200 | 44.8% | 74.4% | +29.6 pts [28.8, 30.4] |
| help requests known 5–10 min after warning (not 1–3) | 100 | 45.0% | 71.6% | +26.6 pts [25.5, 27.7] |
| helpers start far from the fire | 100 | 45.0% | 73.4% | +28.5 pts [27.4, 29.6] |
| 6 helpers instead of 24 | 200 | 45.1% | 65.2% | +20.1 pts [19.4, 20.8] |
| faster fire: 35 mph wind | 200 | 36.7% | 59.9% | +23.3 pts [22.6, 23.9] |
| 35 mph wind and 6 helpers | 200 | 36.7% | 51.7% | +15.0 pts [14.5, 15.6] |
| slow requests + 6 helpers + far start | 100 | 45.0% | 64.5% | +19.5 pts [18.6, 20.4] |
| sanity: 0 helpers | 50 | 44.2% | 44.2% | +0.0 pts [0.0, 0.0] |

Harsher assumptions cut the lift roughly in half in the worst case we ran (fast fire, few helpers) but never to zero; with no helpers the two policies are identical, as they should be. The number of helpers matters most; the request delay matters less because the fire needs about an hour to reach most homes.

**The baseline matters more than any of these.** Every row above assumes neighbours never give each other rides. In Lane D's baseline review ([`BASELINE_REVIEW.md`](BASELINE_REVIEW.md), 100 paired seeds per config), if 30% of neighbours with a car give a ride the lift is +12.3 pts [11.5, 13.2], and with neighbours, families and early alerts all working well it is +4.1 pts [3.5, 4.8]. Last Mile still wins in all 33 configs, so the honest claim is a range of about 4 to 29 points. **Not tested:** helpers that break down or don't show up, wrong or false help requests, people refusing to leave, traffic beyond a flat congestion factor.

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

## Lane A sensitivity variants (100 paired seeds per row, main @ `47c452c`)

`pnpm --filter @lastmile/engine exec tsx src/sim/sensitivityReport.ts 100` (Lane A, real headless, preset base). Raw output:
[`sensitivity/lane-a-sensitivity-100.md`](sensitivity/lane-a-sensitivity-100.md). This script's interval is a normal
approximation (mean ± 1.96 SE of the paired differences), not the bootstrap. Every non-default assumption is printed in
`SimInit.assumptions` with a "SENSITIVITY" marker.

| assumption set | alerts only | Last Mile | lift (pts) [95% CI] | all homes trapped (alerts -> LM) |
|---|---|---|---|---|
| headline (help known 1–3 min, 24 helpers at random nodes) | 45.0% | 74.3% | +29.3 [28.1, 30.5] | 30.3% -> 23.4% |
| help requests known 5–10 min after warning | 45.0% | 71.6% | +26.6 [25.5, 27.7] | 30.3% -> 24.0% |
| 12 helpers | 45.0% | 71.5% | +26.5 [25.4, 27.6] | 30.3% -> 24.0% |
| 6 helpers | 45.0% | 66.0% | +21.0 [19.9, 22.0] | 30.3% -> 25.4% |
| helpers start far from the fire (30% of nodes it reaches last) | 45.0% | 73.4% | +28.5 [27.4, 29.6] | 30.3% -> 23.6% |
| HARSH: 5–10 min + 12 helpers + far start | 45.0% | 68.2% | +23.2 [22.2, 24.3] | 30.3% -> 24.8% |
| HARSHEST: 5–10 min + 6 helpers + far start | 45.0% | 64.5% | +19.5 [18.6, 20.4] | 30.3% -> 25.7% |

## What would make the result weaker (to test next)

- Helpers that break down or arrive late, wrong or false help requests, people who refuse to leave.
- A stronger baseline is now measured (see above and [`BASELINE_REVIEW.md`](BASELINE_REVIEW.md), 33 configs on main @ `d98f2e3`): neighbour rides are most of the gap. Not yet measured: how much of the remaining lift is wheelchair users and homes with no car nearby, which neighbour rides can't serve.
- Other towns (`paradise_like`, `synthetic_grid`): `--town` flag; road data quality differs.
