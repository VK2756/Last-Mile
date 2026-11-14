# Local Monte Carlo evidence

Run on Nov 14, 2026, after Lane D's Monte Carlo merge (#29). This is a synthetic, local in-process run of the real headless engine. It is not production or a real-world effectiveness estimate.

```text
pnpm --filter @lastmile/engine exec tsx scripts/montecarlo-cli.ts --runs 200 --workers 0
runs=200 seeds 1..200 town=amherst wind=20mph@90deg helpers=24  (32.1 s)
  alerts_only evacuated 74.6% [74.3%, 75.0%]  vulnerable evacuated 47.3% [46.6%, 48.1%]  trapped/run 93.5
  last_mile   evacuated 82.3% [82.0%, 82.6%]  vulnerable evacuated 79.6% [78.9%, 80.3%]  trapped/run 65.3
  vulnerableLift (paired, last_mile - alerts_only): 32.2 pts [31.6, 33.0]
```

The intervals come from the evaluator's paired-seed bootstrap. The simulator assumes synthetic people, helpers, fire behavior, travel time, and warning uptake. Repeat through the deployed `/montecarlo` endpoint before using these figures in the submission or video. Do not generalize them to an actual evacuation.
