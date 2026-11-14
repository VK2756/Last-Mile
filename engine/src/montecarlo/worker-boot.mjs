// OWNER: Lane D (Monte Carlo). Plain-JS worker_threads entry. It registers tsx's ESM loader in this
// thread and then loads the TypeScript worker, so workers never depend on inherited loader flags
// (which do not reach worker threads in every setup, e.g. Vitest on Windows; issue #33).
import { register } from 'tsx/esm/api';

register();
await import('./worker.ts');
