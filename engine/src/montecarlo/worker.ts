// OWNER: Lane D (Monte Carlo). worker_threads entry: runs runHeadless for each config it is sent.
import { parentPort } from 'node:worker_threads';
import type { ScenarioConfig } from '@lastmile/contracts';
import { runHeadless } from '../sim/headless';

export interface WorkerTask { id: number; config: ScenarioConfig }
export type WorkerReply = { id: number; metrics: Awaited<ReturnType<typeof runHeadless>> } | { id: number; error: string };

if (!parentPort) throw new Error('montecarlo/worker.ts must run inside a worker thread');
const port = parentPort;
port.on('message', (task: WorkerTask) => {
  runHeadless(task.config).then(
    (metrics) => port.postMessage({ id: task.id, metrics } satisfies WorkerReply),
    (err: unknown) => port.postMessage({ id: task.id, error: err instanceof Error ? err.stack ?? err.message : String(err) } satisfies WorkerReply),
  );
});
