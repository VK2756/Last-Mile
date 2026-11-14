// OWNER: Lane A. Picks the DataSink: DATA_SINK=real loads Lane C's @lastmile/data, anything else (or any failure) uses the in-memory sink.
import { createMemorySink, type SimInit } from '@lastmile/contracts';
import type { EngineSink } from './engine';

export async function loadSink(): Promise<EngineSink> {
  if (process.env.DATA_SINK === 'real') {
    try {
      const spec = '@lastmile/data'; // variable specifier: not resolved at typecheck time, engine has no hard dependency on it
      const mod = (await import(spec)) as { createDataSink: () => EngineSink; upsertWorld?: (init: SimInit) => Promise<void> };
      const sink = mod.createDataSink();
      if (mod.upsertWorld) sink.onWorld = mod.upsertWorld; // persists the real run's households + helpers (issue #17)
      return sink;
    } catch (e) { console.error('[sink] DATA_SINK=real but @lastmile/data failed to load; using memory sink:', e); }
  }
  const mem = createMemorySink();
  // keep the in-memory sink bounded in a long-running server
  const trim = () => { if (mem.risk.length > 50_000) mem.risk.splice(0, mem.risk.length - 50_000); };
  return { ...mem, recordRisk: async (s) => { await mem.recordRisk(s); trim(); }, recordDispatch: mem.recordDispatch, recordOutcome: mem.recordOutcome };
}
