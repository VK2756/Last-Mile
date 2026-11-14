import type { Policy, ScenarioConfig } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';

export type BaseConfig = Omit<ScenarioConfig, 'policy'>;

/** Default run: fixture town/ignition with a realistic helper pool. */
export const DEFAULT_BASE: BaseConfig = {
  seed: sampleInit.config.seed,
  town: sampleInit.config.town,
  helperCount: 24,
  wind: { ...sampleInit.config.wind },
  ignition: { ...sampleInit.config.ignition },
  speedMultiplier: 12,
};

export const withPolicy = (base: BaseConfig, policy: Policy): ScenarioConfig => ({ ...base, policy });
