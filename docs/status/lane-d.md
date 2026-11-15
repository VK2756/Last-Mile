# Lane D status (ROUTING / DISPATCH / MONTE CARLO, Rishabh)
_Updated 2026-11-14 ~8:15pm._

## Merged
#20 routing, #23 dispatch, #28 Monte Carlo, #35 dispatch reasons, #43 real Amherst roads (closed #45), #47 Windows worker fix (closed #33), #66 Monte Carlo ~2x cheaper (exact), #75 fuzz invariants, #76 + #89 baseline fairness review, #85 scenario stories + map alignment, #90 perf-test bound (closed #77), #92 model assumptions in the Monte Carlo response (closed #78), #96 status, #107 baseline review rerun with the #69/#71-#73 knobs, plus this PR (lift by household group, fresh-seed holdout, fuzz with every knob, node-distance check). No open lane:d issues.

## Monte Carlo (mounted in server.ts by Lane A)
- `POST /montecarlo` / `GET /montecarlo/preset` return `MonteCarloComparison`. `assumptions` now includes the simulator's model assumptions for the base config (#78), so /results needs no throwaway scenario.
- Real Amherst roads, preset, 200 paired seeds, main after #66: vulnerable evacuated 45% -> ~74%, lift about +29 pts (CI about +/-1). Results are exact: #66 changed speed only.
- Speed: N=200 on 2 workers 27.4 s wall on this laptop (was 50.4 s); single-thread ~220-256 ms per seed pair (was 544 ms). For Lane C: 2 vCPU is now enough for the 60 s budget.

## For Lane E (Prince): baseline review rerun with the new knobs, please update the pitch numbers
`docs/submission/BASELINE_REVIEW.md` now has 33 configs, 100 paired seeds each, including Lane A's new baseline and fleet knobs (#69, #71, #72, #73). **The +29 lift assumes neighbours never give rides.** With 30% of neighbours giving rides the lift is +12; with every baseline knob turned up together it is +4.1 [3.5, 4.8]. Last Mile still wins in all 33. The review's pitch sentence is now a range (+29 with no neighbour rides, +12 with rides at 30%, about +4 with a strong baseline). Pages and docs that quote "45% -> 74%" on its own should add that caveat.

## Lift by household group (new, in BASELINE_REVIEW.md, `scripts/group-lift.ts`)
Seeds 1-200, paired. **91% of Last Mile's extra evacuations are homes without a car that have a car-owning neighbour within 300 m** (12% -> 71% evacuated). With 30% neighbour rides it is still 81% (55% -> 77%), and with everything generous, 68%. Wheelchair homes gain only about +6 points, because 71% already get out under alerts only. The model has no age field, so "elderly alone" uses the proxy "1 resident with a medical need".

## Fresh-seed holdout
Seeds 7,000,001-7,000,200, which no earlier run used: lift +30.1 [29.3, 30.9], against the headline's +29.4 [28.6, 30.2] on seeds 1-200. The CIs overlap.

## Fuzz invariants (`scripts/fuzz-invariants.ts 300`, now with every optional knob)
300 configs, each drawing helperMix, helperCapacityScale and every baseline knob about half the time. New checks: one helper per home (per plan and per frame), helper loads equal riders, all times finite, metrics add up, the same fire for both policies frame by frame, and termination by the engine's 4 h cap. **After Lane A's #122 (fixes #114 and #118): 300/300 pass.** Before it, 71 seeds failed only on #114 (a frame listed a home under two helpers; display only), and seed 227 exposed #118 (a loaded helper waited forever for a safe zone the fire had cut off; 11 of 200 headline runs, 43 people). The headline lift (+29.4) and the holdout (+30.1) are unchanged after #122 to one decimal. CI runs seeds 1-3, which pass.

## Map: distance to the nearest road node (`scripts/check-node-distance.ts`)
All 6 presets (including the three story presets from #81) plus the Monte Carlo preset: homes are a median 24-25 m and at most 49 m from a routable node, and every helper starts exactly on a node (0 m). **No point is over 50 m, so there is no Lane A issue.**

## #77 / #78
#77: the timing test passed 30 times out of 30 with all 14 cores busy (median 4.9-7.3 ms, one run 30.9 ms, bound 60 ms); commented on the issue. #78: already merged in #92 as an addition to the existing `assumptions` field (no contract change); commented so Lane E can switch /results over.

## Scenario stories on real roads (exact configs in #81 for Lane A presets)
Each seed is the median-lift seed of 10, not the best. 24 helpers, 20 mph wind.
1. **south-fire-cut-off** (seed 4, ignition 42.36242,-72.5199, wind toward 180): burning roads cut homes off (~7 per run). Vulnerable 8/21 -> 11/21 (+14; +8 to +31 over 10 seeds). This is where Last Mile struggles, and the demo should say so.
2. **southeast-big-lift** (seed 10, ignition 42.36242,-72.505309, wind toward 180): vulnerable 9/18 -> 17/18 (+44; +14 to +60), trapped 15 -> 7.
3. **downtown-north-wheelchair** (seed 7, ignition 42.3732,-72.5199, wind toward 0): vulnerable 44/98 -> 76/98 (+33), but ~5.5 wheelchair homes per run are still trapped without a capable vehicle.
(These numbers were measured before Lane A's latest default changes; the ranking is what matters for picking presets.)

## Map alignment (checked, no Lane B issue)
Homes are a median 13 m from a road (max ~48 m); helpers and safe zones are on road nodes; fire rings are `[lng, lat]` and enclose the ignition. Overlaid on the same OpenFreeMap/OSM basemap the web uses, the baked roads sit exactly on the streets.

## Next
Re-time Monte Carlo on the Vultr box once Lane C reports its size; nothing queued. Lane A: #69, #71, #72, #73 are implemented and can be closed. **Blockers:** none.
