# Baseline fairness review: is "alerts only" a strawman?

**This is a simulation with synthetic people.** Every number below comes from the real engine (`runHeadless`), on the real Amherst, MA road network (OpenStreetMap), with paired seeds: for each seed both policies face the same fire, the same synthetic households and the same helpers; only the policy differs. Nothing was tuned to make Last Mile look better. Owner: Lane D (Rishabh). Reproduce with `cd engine && pnpm exec tsx scripts/baseline-stress.ts 100`.

## What the baseline does (engine/src/policy/alertsOnly.ts)
- Every household with a vehicle leaves on its own after the alert plus a preparation delay (about 6 min on average, longer with children or pets).
- A household without a vehicle leaves only if a relative or friend picks it up: 25% have one, arriving 15-40 min after the warning. The rest wait.
- This baseline runs **unchanged under Last Mile**. Last Mile only adds dispatched helpers on top. So everything the baseline gets right, Last Mile gets too, and the lift measures the dispatch alone.

## Stress test: only the public ScenarioConfig knobs (100 paired seeds per row)
"Vulnerable" means no vehicle, or wheelchair, oxygen, dementia, medical device or vision impairment (one shared definition in the contracts). Lift = paired difference in the vulnerable evacuated rate, Last Mile minus alerts only, with a percentile-bootstrap 95% CI.

| group | config | seeds | alerts-only vulnerable evac | Last Mile vulnerable evac | lift, pts [95% CI] | all homes evac (AO -> LM) |
|---|---|---|---|---|---|---|
| reference | preset (wind 20 mph E, 24 helpers) | 1-100 | 45.0% | 72.6% | 27.6 [26.5, 28.8] | 69.7% -> 76.2% |
| seeds | preset | 5001-5100 | 43.2% | 70.2% | 27.0 [25.8, 28.3] | 69.2% -> 75.7% |
| seeds | preset | 90001-90100 | 44.6% | 72.5% | 27.8 [26.7, 28.9] | 69.7% -> 76.3% |
| fewer helpers | **1 helper** | 1-100 | 45.0% | 50.8% | **5.8 [4.8, 6.8]** | 69.7% -> 71.0% |
| fewer helpers | 3 helpers | 1-100 | 45.0% | 58.3% | 13.3 [12.3, 14.4] | 69.7% -> 72.8% |
| fewer helpers | 6 helpers | 1-100 | 45.0% | 64.6% | 19.6 [18.6, 20.7] | 69.7% -> 74.3% |
| fewer helpers | 12 helpers | 1-100 | 45.0% | 70.0% | 25.0 [24.0, 26.1] | 69.7% -> 75.6% |
| wind | wind 0 mph | 1-100 | 57.0% | 94.2% | 37.2 [36.0, 38.4] | 86.3% -> 95.0% |
| wind | wind 10 mph | 1-100 | 50.6% | 77.9% | 27.3 [26.0, 28.5] | 77.4% -> 83.8% |
| wind | wind 35 mph | 1-100 | 38.1% | 62.0% | 23.9 [22.8, 25.0] | 59.0% -> 64.7% |
| wind | wind 50 mph | 1-100 | 32.4% | 52.2% | 19.8 [18.8, 20.8] | 49.6% -> 54.2% |
| fast fire + few helpers | wind 50 mph, 3 helpers | 1-100 | 32.4% | 45.3% | 12.9 [11.9, 13.8] | 49.6% -> 52.6% |
| fast fire + few helpers | **wind 50 mph, 1 helper** | 1-100 | 32.4% | 38.6% | **6.1 [5.3, 7.0]** | 49.6% -> 51.0% |
| wind direction | wind 20 mph toward N | 1-100 | 44.7% | 74.9% | 30.3 [29.3, 31.2] | 72.5% -> 79.7% |
| wind direction | wind 20 mph toward SW | 1-100 | 49.3% | 82.6% | 33.4 [32.1, 34.6] | 77.9% -> 85.8% |
| ignition point | 1.2 km N | 1-100 | 50.0% | 83.7% | 33.7 [32.6, 35.0] | 77.8% -> 85.8% |
| ignition point | 1.2 km S | 1-100 | 56.8% | 92.8% | 36.0 [34.7, 37.4] | 86.4% -> 94.8% |
| ignition point | 1.2 km E | 1-100 | 44.8% | 71.6% | 26.8 [24.8, 28.8] | 66.3% -> 72.6% |
| ignition point | 1.2 km W | 1-100 | 51.0% | 82.1% | 31.1 [30.1, 32.1] | 81.1% -> 88.4% |
| town | synthetic grid instead of real roads | 1-100 | 47.1% | 80.1% | 33.0 [32.0, 34.0] | 74.8% -> 82.7% |

Sanity check: with 0 helpers, both policies give identical results (lift exactly 0.0), so the comparison has no built-in bias.

## Honest reading
- **Last Mile never loses in these configs, but it can win by little.** With a single helper the lift is only about 6 points (5.8 with a normal fire, 6.1 with a 50 mph wind). The lift scales with the number of helpers: 1 -> +5.8, 3 -> +13.3, 6 -> +19.6, 12 -> +25.0, 24 -> +27.6. **Helper count is the assumption that matters most.**
- **Fast fires cap what any dispatch can do.** At 50 mph wind, even 24 helpers only get vulnerable evacuation to 52%: the fire reaches homes before anyone can get there.
- **The gain is almost entirely for vulnerable homes.** "All homes evacuated" rises only 1-9 points, because households with a car already self-evacuate in both policies.
- **Real roads matter.** The same preset on the synthetic grid shows +33.0; on real Amherst streets it is +27.6. One-way streets, sparse connections and longer detours make every trip slower. We report the real-roads numbers.
- Lane A's sensitivity table (`docs/status/lane-a.md`; knobs that are not public yet) agrees. Request delay of 5-10 min, 6 helpers and helpers starting far from the fire together cut the lift from +30 to +20, never to zero.

## What we cannot test yet (stronger baselines need knobs that don't exist)
A judge could fairly say the baseline is pessimistic, because these real-world behaviours aren't modelled. Each one is filed as a Lane A issue; we'll rerun this table when they land:
- **Neighbours helping neighbours** (#69): today a neighbour with a car never offers a seat. Probably the most important missing behaviour, and it would shrink the lift.
- **More generous self-evacuation and family pickup** (#71): the 25% family-pickup rate and the prep delays are fixed constants.
- **A smarter family pickup** (#72): relatives currently arrive 15-40 min after the warning regardless of how close the fire is.
- **Small helper capacity / fleet mix** (#73): helper capacity is fixed by kind (3-12 seats). An all-neighbour fleet with no wheelchair vehicles can't be tested yet.

Also not modelled: helpers who don't show up or break down, wrong or missing help requests, traffic jams beyond a flat 1.3x congestion factor, and spotting fires. Each would lower Last Mile's numbers.

## How to say it in the pitch
"In our simulation of Amherst's real roads, coordinated dispatch raised the share of vulnerable households that got out from 45% to 73% (+28 points, 95% CI 26-29, 100 paired runs). The gain depends mostly on how many helpers exist: with one helper it's 6 points. Our baseline doesn't yet model neighbours giving rides, so treat this as an upper-end estimate."
