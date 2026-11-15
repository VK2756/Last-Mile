# Baseline fairness review: is "alerts only" a strawman?

**This is a simulation with synthetic people.** Every number below comes from the real engine (`runHeadless`), on the real Amherst, MA road network (OpenStreetMap), with paired seeds: for each seed both policies face the same fire, the same synthetic households and the same helpers; only the policy differs. Nothing was tuned to make Last Mile look better. Owner: Lane D (Rishabh). Reproduce with `cd engine && pnpm exec tsx scripts/baseline-stress.ts 100`.

## What the baseline does (engine/src/policy/alertsOnly.ts)
- Every household with a vehicle leaves on its own after the alert plus a preparation delay (about 6 min on average, longer with children or pets).
- A household without a vehicle leaves only if a relative or friend picks it up: 25% have one, arriving 15-40 min after the warning. The rest wait.
- This baseline runs **unchanged under Last Mile**. Last Mile only adds dispatched helpers on top. So everything the baseline gets right, Last Mile gets too, and the lift measures the dispatch alone.

## Stress test: only the public ScenarioConfig knobs (100 paired seeds per row)
The last 13 rows use the baseline and fleet knobs Lane A added for #69, #71, #72 and #73. The knob values are round numbers fixed before running; each one makes the alerts-only baseline stronger or the Last Mile fleet weaker, and every knob applies identically to both policies.
"Vulnerable" means no vehicle, or wheelchair, oxygen, dementia, medical device or vision impairment (one shared definition in the contracts). Lift = paired difference in the vulnerable evacuated rate, Last Mile minus alerts only, with a percentile-bootstrap 95% CI.

| group | config | seeds | alerts-only vulnerable evac | Last Mile vulnerable evac | lift, pts [95% CI] | all homes evac (AO -> LM) |
|---|---|---|---|---|---|---|
| reference | preset (wind 20 mph E, 24 helpers) | 1-100 | 45.0% | 74.3% | 29.3 [28.1, 30.5] | 69.7% -> 76.6% |
| seeds | preset | 5001-5100 | 43.2% | 73.4% | 30.2 [29.2, 31.3] | 69.2% -> 76.4% |
| seeds | preset | 90001-90100 | 44.6% | 75.6% | 30.9 [29.8, 32.2] | 69.7% -> 77.0% |
| fewer helpers | **1 helper** | 1-100 | 45.0% | 50.9% | **5.9 [4.9, 6.9]** | 69.7% -> 71.1% |
| fewer helpers | 3 helpers | 1-100 | 45.0% | 59.2% | 14.2 [13.1, 15.3] | 69.7% -> 73.0% |
| fewer helpers | 6 helpers | 1-100 | 45.0% | 66.0% | 21.0 [20.0, 22.1] | 69.7% -> 74.6% |
| fewer helpers | 12 helpers | 1-100 | 45.0% | 71.5% | 26.5 [25.4, 27.6] | 69.7% -> 76.0% |
| wind | wind 0 mph | 1-100 | 57.0% | 93.6% | 36.6 [35.5, 37.8] | 86.3% -> 94.9% |
| wind | wind 10 mph | 1-100 | 50.6% | 83.3% | 32.7 [31.6, 34.0] | 77.4% -> 85.1% |
| wind | wind 35 mph | 1-100 | 38.1% | 63.1% | 25.0 [24.0, 26.0] | 59.0% -> 64.9% |
| wind | wind 50 mph | 1-100 | 32.4% | 52.9% | 20.5 [19.6, 21.6] | 49.6% -> 54.4% |
| fast fire + few helpers | wind 50 mph, 3 helpers | 1-100 | 32.4% | 45.2% | 12.8 [11.8, 13.8] | 49.6% -> 52.6% |
| fast fire + few helpers | **wind 50 mph, 1 helper** | 1-100 | 32.4% | 38.5% | **6.1 [5.3, 6.9]** | 49.6% -> 51.0% |
| wind direction | wind 20 mph toward N | 1-100 | 44.7% | 76.1% | 31.5 [30.6, 32.3] | 72.5% -> 79.9% |
| wind direction | wind 20 mph toward SW | 1-100 | 49.3% | 83.7% | 34.4 [33.3, 35.7] | 77.9% -> 86.1% |
| ignition point | 1.2 km N | 1-100 | 50.0% | 85.6% | 35.6 [34.5, 36.8] | 77.8% -> 86.3% |
| ignition point | 1.2 km S | 1-100 | 56.8% | 93.6% | 36.8 [35.6, 38.2] | 86.4% -> 95.0% |
| ignition point | 1.2 km E | 1-100 | 44.8% | 71.8% | 27.1 [25.1, 29.0] | 66.3% -> 72.7% |
| ignition point | 1.2 km W | 1-100 | 51.0% | 85.7% | 34.7 [33.8, 35.6] | 81.1% -> 89.3% |
| town | synthetic grid instead of real roads | 1-100 | 47.1% | 82.1% | 35.0 [34.0, 36.0] | 74.8% -> 83.1% |
| neighbours give rides (#69) | neighborRideProb 0.3 | 1-100 | 65.0% | 77.3% | **12.3 [11.5, 13.2]** | 74.3% -> 77.3% |
| neighbours give rides (#69) | neighborRideProb 0.6 | 1-100 | 70.3% | 77.8% | 7.5 [6.8, 8.3] | 75.4% -> 77.3% |
| neighbours give rides (#69) | neighborRideProb 1 (every car with a free seat) | 1-100 | 72.8% | 78.2% | 5.4 [4.8, 6.0] | 76.0% -> 77.3% |
| self-evac / family pickup (#71) | familyPickupProb 0.5 (default 0.25) | 1-100 | 50.7% | 74.3% | 23.6 [22.4, 24.8] | 71.0% -> 76.6% |
| self-evac / family pickup (#71) | familyPickupProb 0.75 | 1-100 | 56.7% | 74.3% | 17.7 [16.7, 18.7] | 72.5% -> 76.6% |
| self-evac / family pickup (#71) | prepDelayScale 0.5 (cars leave twice as fast) | 1-100 | 46.9% | 76.2% | 29.3 [28.1, 30.5] | 73.8% -> 80.8% |
| self-evac / family pickup (#71) | alertIssueS 0 (alert at ignition, default 300 s) | 1-100 | 49.0% | 81.2% | 32.1 [31.0, 33.4] | 76.4% -> 84.0% |
| smarter family pickup (#72) | urgentFamilyPickup | 1-100 | 49.1% | 75.3% | 26.3 [25.1, 27.5] | 70.7% -> 76.9% |
| **strong baseline (all)** | rides 0.6, family 0.5, urgent pickup, prep 0.5, alert at ignition | 1-100 | 84.5% | 88.6% | **4.1 [3.5, 4.8]** | 88.5% -> 89.5% |
| **strong baseline (all)** | same, 6 helpers | 1-100 | 84.5% | 87.8% | **3.4 [2.8, 3.9]** | 88.5% -> 89.3% |
| fleet (#73) | helperCapacityScale 0.5 (half the seats) | 1-100 | 45.0% | 70.8% | 25.8 [24.8, 26.9] | 69.7% -> 75.8% |
| fleet (#73) | neighbours only (no wheelchair-capable vehicles) | 1-100 | 45.0% | 66.7% | 21.8 [20.8, 22.8] | 69.7% -> 74.8% |
| fleet (#73) | volunteers only | 1-100 | 45.0% | 71.0% | 26.0 [25.0, 27.1] | 69.7% -> 75.9% |

Run on main at d98f2e3 (2026-11-14). The first 20 rows are unchanged from the run at 53c9510, because the new knobs default to off. (The first version of this table, on older Lane A defaults, gave +27.6 for the preset.)

Sanity check: with 0 helpers, both policies give identical results (lift exactly 0.0), so the comparison has no built-in bias.

## Honest reading
- **The baseline was pessimistic, and neighbour rides are most of the gap.** If 30% of departing households with a car and a free seat pick up the nearest vehicle-less neighbour (within about 300 m, one stop, no wheelchair), alerts-only rises from 45% to 65% and the lift falls from +29 to **+12**. At 60% it is +7.5; if every car with a seat helps, +5.4. Last Mile itself barely moves (74% -> 77-78%): rides mostly reach homes its helpers would have reached anyway. **The remaining lift is still mostly homes without a car that have a car-owning neighbour nearby** (81% of Last Mile's extra evacuations at 30% rides), not wheelchair users (14%); see the breakdown below.
- **With every baseline knob turned up at once, Last Mile wins by only about 4 points** (84.5% -> 88.6%, +4.1 [3.5, 4.8]; +3.4 with 6 helpers). The CI stays above zero, but in an optimistic town where neighbours, families and early alerts already work, coordinated dispatch adds little.
- **Family pickup matters, timing much less.** Doubling family pickup to 50% cuts the lift to +23.6, and 75% cuts it to +17.7. Faster car departures leave it at +29.3, because cars already leave in both policies. An alert at ignition raises it to +32.1, since earlier warnings help dispatch too. Relatives who hurry when the fire is near cut it to +26.3.
- **The fleet assumptions matter less than the head count.** Half the seats gives +25.8; an all-neighbour fleet with no wheelchair-capable vehicle gives +21.8; volunteers only, +26.0. Compare 6 helpers (+21.0) or 1 helper (+5.9).
- **Last Mile never loses in these 33 configs**, but it can win by little: about 6 points with a single helper, about 4 against a strong baseline.
- **Fast fires cap what any dispatch can do.** At 50 mph wind, even 24 helpers only get vulnerable evacuation to 53%.
- **The gain is almost entirely for vulnerable homes.** "All homes evacuated" rises only 1-9 points.
- **Real roads matter.** The same preset on the synthetic grid shows +35.0; on real Amherst streets it is +29.3. We report the real-roads numbers.

## Where the lift comes from (by household group)
Same paired seeds as the headline (1-200), both policies, three baselines. Groups are exclusive and assigned in the order listed. Only homes the fire reaches within the horizon are counted, as in the headline metrics. Two caveats about the groups. The model has no age field, so **"alone + medical need" (1 resident with oxygen, dementia, a medical device or a vision impairment) stands in for "elderly alone"**. It also has no separate limited-mobility need, so "wheelchair" means the wheelchair need. "Car within 300 m" means at least one household with a vehicle lives within the neighbour-ride radius. "Share" is the group's part of all the extra homes Last Mile evacuates. Reproduce with `cd engine && pnpm exec tsx scripts/group-lift.ts 200`.

| baseline | group | at-risk homes per run | alerts-only evac | Last Mile evac | lift, pts [95% CI] | share of extra evacuations |
|---|---|---|---|---|---|---|
| preset defaults | wheelchair | 16.6 | 70.9% | 77.3% | 6.3 [5.4, 7.2] | 6% |
| | alone + medical need | 5.1 | 68.3% | 75.8% | 7.8 [5.8, 9.9] | 2% |
| | no car, no car within 300 m | 0.4 | 12.7% | 74.7% | 60.3 [48.4, 71.4] | 1% |
| | **no car, car within 300 m** | 29.5 | 12.1% | 71.1% | **59.1 [57.5, 60.6]** | **91%** |
| | everyone else (has a car) | 222.7 | 77.4% | 77.4% | 0.0 [0.0, 0.0] | 0% |
| 30% neighbour rides | wheelchair | 16.6 | 70.7% | 77.4% | 6.5 [5.6, 7.4] | 14% |
| | alone + medical need | 5.1 | 74.8% | 76.3% | 1.7 [0.7, 2.6] | 1% |
| | no car, no car within 300 m | 0.4 | 12.7% | 79.7% | 65.9 [54.0, 76.2] | 3% |
| | **no car, car within 300 m** | 29.5 | 54.9% | 77.1% | **22.2 [21.0, 23.4]** | **81%** |
| | everyone else (has a car) | 222.7 | 77.3% | 77.3% | 0.0 [0.0, 0.0] | 1% |
| everything generous at once | wheelchair | 16.6 | 84.6% | 88.8% | 4.0 [3.3, 4.8] | 24% |
| | alone + medical need | 5.1 | 87.2% | 87.3% | 0.1 [-0.2, 0.4] | 0% |
| | no car, no car within 300 m | 0.4 | 55.7% | 70.9% | 14.8 [1.8, 27.3] | 2% |
| | **no car, car within 300 m** | 29.5 | 82.9% | 89.7% | **6.8 [6.0, 7.5]** | **68%** |
| | everyone else (has a car) | 222.7 | 89.8% | 89.8% | 0.1 [0.1, 0.1] | 6% |

Last Mile evacuates 19.1 more at-risk homes per run under the preset, 8.1 with 30% rides, and 2.9 with everything generous.

What the data shows:
- **The lift is about households without a car.** They are about 30 of the roughly 274 at-risk homes per run, but they account for 91% of Last Mile's extra evacuations under the preset defaults. Under alerts only, just 12% of them get out; with Last Mile, 71% do.
- **Neighbour rides shrink that gap but don't close it.** With 30% rides, 55% of car-less homes get out without Last Mile and 77% with it. Even in the generous baseline, those homes still make up two thirds of Last Mile's gain.
- **Wheelchair users gain much less than we assumed: about 6 points.** That's because 71% of them already get out under alerts only. Their share of the gain grows as the baseline improves (6% -> 14% -> 24%) because the other groups' gains shrink faster. Only 7 of the 24 default helpers (5 accessible vans, 2 shuttle buses) can carry a wheelchair. That may limit this group, but we haven't tested it.
- **Homes with no car within 300 m are rare in Amherst's synthetic population** (0.4 per run), so their large lift (+60) has a wide CI and adds little to the total.
- **Households with a car gain nothing** (+0.0), as expected: they leave on their own under both policies.

## Fresh-seed holdout
Headline config (preset, 24 helpers), 200 paired seeds from a block no earlier run used: **7,000,001-7,000,200**. Earlier runs used 1-200, 1001-1200, 5001-5100 and 90001-90100, and fuzz draws sim seeds from 0-999,999. Run on main at ab394b9.

| seeds | alerts-only vulnerable evac | Last Mile vulnerable evac | lift, pts [95% CI] |
|---|---|---|---|
| 1-200 (headline) | 45.1% [44.2, 45.9] | 74.5% [73.6, 75.3] | 29.4 [28.6, 30.2] |
| 7,000,001-7,000,200 (holdout) | 44.1% [43.2, 45.0] | 74.2% [73.3, 75.1] | **30.1 [29.3, 30.9]** |

The holdout lift is 0.7 points higher, and the two CIs overlap, so the headline is not an artefact of the seeds it was measured on. Reproduce with `cd engine && pnpm exec tsx scripts/montecarlo-cli.ts --runs 200 --seed-start 7000001`.

## Which baseline is realistic?
We don't know the real neighbour-ride rate in Amherst, and we did not pick one to suit the result. The default (no rides, 25% family pickup) is the low end; the "strong baseline" row is a deliberately generous high end. The honest claim is a range: **between about +4 and +29 points, about +12 if roughly a third of neighbours give rides.** Issues #69, #71, #72 and #73 are implemented on main (Lane A can close them).

**Still not modelled:** helpers who don't show up or break down, wrong or missing help requests, traffic jams beyond a flat 1.3x congestion factor, and spotting fires. Each would lower Last Mile's numbers.

## How to say it in the pitch
"In our simulation of Amherst's real roads, coordinated dispatch raised the share of vulnerable households that got out from 45% to 74% (+29 points, 95% CI 28-31, 100 paired runs) against a baseline where neighbours don't give rides. If a third of neighbours with a car pick someone up, the gain is +12 points; with neighbours, families and early alerts all working well, it is about +4. Coordinated dispatch matters most where informal help is thin."

Plain-language takeaway: **Last Mile helps the people who have no car of their own. In our simulation they are about 1 in 9 homes in the fire's path but 9 in 10 of the extra people it gets out, and even when a third of neighbours offer rides, nearly half of them still don't get out without it.**
