// OWNER: Lane A. Headless run: the SAME engine code as the streamed run, no stream, no sink. Same seed => same Metrics.
import type { HeadlessRunner } from '@lastmile/contracts';
import { createSim, type SimOptions } from './engine';

export const runHeadless: HeadlessRunner = async (config) => runHeadlessWith(config);

export function runHeadlessWith(config: Parameters<HeadlessRunner>[0], opts: SimOptions = {}) {
  const sim = createSim(config, `headless-${config.seed}-${config.policy}`, opts);
  while (!sim.done) sim.advance(600);
  return sim.finalMetrics();
}
