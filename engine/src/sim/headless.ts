// OWNER: Lane A (Engine). STUB: returns fake metrics so Lane A's Monte Carlo can be built. Replace with the real simulator.
import type { HeadlessRunner } from '@lastmile/contracts';
export const runHeadless: HeadlessRunner = async (config) => {
  const total = 600;
  return { total, evacuated: Math.round(total * 0.7), trapped: Math.round(total * 0.1), inProgress: 0, vulnerableTotal: 120, vulnerableEvacuated: config.policy === 'last_mile' ? 90 : 50, vulnerableTrapped: 10 };
};
