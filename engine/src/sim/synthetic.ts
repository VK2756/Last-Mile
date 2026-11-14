// OWNER: Lane A. M1 placeholder runner: replays the contract fixtures with advancing time.
// STUB: replaced by the real engine (sim/engine.ts) in M2.
import { sampleFrame, sampleInit } from '@lastmile/contracts/fixtures';
import type { Metrics, ScenarioConfig, SimFrame, SimInit } from '@lastmile/contracts';
import type { ScenarioRunner } from './registry';

export function createSyntheticRunner(scenarioId: string, config: ScenarioConfig, DURATION_S = 1800): ScenarioRunner {
  const init: SimInit = { ...sampleInit, scenarioId, config };
  let t = 0;
  const metrics = (): Metrics => ({ ...sampleFrame.metrics });
  return {
    init,
    get done() { return t >= DURATION_S; },
    step(dt: number): SimFrame {
      t = Math.min(DURATION_S, t + dt);
      return { ...sampleFrame, scenarioId, policy: config.policy, t, metrics: metrics() };
    },
    finalMetrics: metrics,
  };
}
