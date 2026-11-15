// OWNER: Lane A (requested by the human; new file in engine/scripts). Load test for the public engine:
// opens N concurrent /live streams plus one Monte Carlo request and reports server CPU, memory and frame gaps.
// Usage (from engine/):
//   pnpm exec tsx scripts/load-sse.ts [--streams 20] [--seconds 60] [--speed 8] [--url http://host:8080 --pid <enginePid>]
// With no --url it starts the engine itself (NODE_ENV=production, ENGINE_MC_WORKERS from env) so it can sample its CPU and RSS.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { PRESETS } from '../src/sim/presets';

const args = process.argv.slice(2);
const opt = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1]! : d; };
const STREAMS = Number(opt('streams', '20')); const SECONDS = Number(opt('seconds', '60')); const SPEED = Number(opt('speed', '8'));
let base = opt('url', ''); let pid = Number(opt('pid', '0')); let child: ChildProcess | undefined;

const sample = (p: number) => { try { const [cpu, rss] = execFileSync('ps', ['-o', '%cpu=,rss=', '-p', String(p)]).toString().trim().split(/\s+/).map(Number); return { cpu: cpu!, rssMb: rss! / 1024 }; } catch { return undefined; } };
const pct = (xs: number[], q: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]!; };

async function main() {
  if (!base) {
    const port = 8300 + Math.floor(Math.random() * 500);
    child = spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], { env: { ...process.env, NODE_ENV: 'production', PORT: String(port), LOG_LEVEL: 'warn', ENGINE_RATE_LIMIT_PER_MIN: '10000', ENGINE_MAX_SCENARIOS: '500' }, stdio: 'ignore', detached: true });
    base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 200)); }
    // the engine runs under `pnpm exec`; find the node process that is listening on the port
    // let the start-up preset warm-up finish so the Monte Carlo request below is a real second batch, not a 429
    for (let i = 0; i < 600; i++) { try { if ((await fetch(`${base}/montecarlo/preset`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 1000)); }
    pid = Number(execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']).toString().split('\n')[0]);
  }
  console.log(`target ${base}  pid ${pid || 'unknown'}  ${STREAMS} streams x ${SECONDS}s at speed ${SPEED}`);
  const gaps: number[] = []; const firstFrame: number[] = []; let frames = 0; let bytes = 0; let ends = 0; let errors = 0;
  const stop = new AbortController();
  const open = async (i: number) => {
    const preset = PRESETS[i % PRESETS.length]!;
    const cfg = { ...preset.config, seed: 1000 + i, speedMultiplier: SPEED };
    const t0 = performance.now();
    const { scenarioId } = await (await fetch(`${base}/scenarios`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg) })).json() as { scenarioId: string };
    const r = await fetch(`${base}/scenarios/${scenarioId}/stream`, { signal: stop.signal });
    const reader = r.body!.getReader(); const dec = new TextDecoder(); let last = 0; let gotFirst = false;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.length; const text = dec.decode(value, { stream: true });
      for (const part of text.split('\n\n')) {
        if (part.startsWith('data: {"type":"frame"')) { const now = performance.now(); frames++; if (last) gaps.push(now - last); last = now; if (!gotFirst) { gotFirst = true; firstFrame.push(now - t0); } }
        else if (part.startsWith('data: {"type":"end"')) ends++;
      }
    }
  };
  const tasks = Array.from({ length: STREAMS }, (_, i) => open(i).catch((e) => { if (!stop.signal.aborted) { errors++; console.error('stream', i, String(e)); } }));
  const samples: { cpu: number; rssMb: number; mc: boolean }[] = []; let mcOn = false;
  const sampler = setInterval(() => { const s = pid ? sample(pid) : undefined; if (s) samples.push({ ...s, mc: mcOn }); }, 1000);
  await new Promise((r) => setTimeout(r, 8000));
  mcOn = true; const mcStart = performance.now();
  const mc = fetch(`${base}/montecarlo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runs: 40, seeds: Array.from({ length: 40 }, (_, i) => 5000 + i) }) })
    .then(async (r) => { await r.text(); return { status: r.status, ms: Math.round(performance.now() - mcStart) }; }).catch((e) => ({ status: 0, ms: 0, err: String(e) }));
  const mcRes = await mc; mcOn = false;
  await new Promise((r) => setTimeout(r, Math.max(0, SECONDS * 1000 - (performance.now() - mcStart) - 8000)));
  stop.abort(); clearInterval(sampler); await Promise.allSettled(tasks);
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / (xs.length || 1));
  const streamsOnly = samples.filter((s) => !s.mc).slice(2); const withMc = samples.filter((s) => s.mc);
  const cpus = samples.map((s) => s.cpu); const rss = samples.map((s) => s.rssMb);
  const out = {
    streams: STREAMS, seconds: SECONDS, speed: SPEED, streamErrors: errors, streamsEnded: ends, framesReceived: frames,
    firstFrameMs: { p50: Math.round(pct(firstFrame, 0.5)), max: Math.round(Math.max(...firstFrame)) },
    frameGapMs: { expected: 500, p50: Math.round(pct(gaps, 0.5)), p95: Math.round(pct(gaps, 0.95)), p99: Math.round(pct(gaps, 0.99)), max: Math.round(Math.max(...gaps)) },
    kbPerSecPerStream: Math.round(bytes / 1024 / SECONDS / STREAMS),
    serverCpuPct: { streamsOnlyAvg: avg(streamsOnly.map((s) => s.cpu)), streamsOnlyPeak: Math.round(Math.max(0, ...streamsOnly.map((s) => s.cpu))), withMonteCarloAvg: avg(withMc.map((s) => s.cpu)), withMonteCarloPeak: Math.round(Math.max(0, ...withMc.map((s) => s.cpu))) },
    serverRssMb: { start: Math.round(rss[0] ?? 0), peak: Math.round(Math.max(0, ...rss)) },
    montecarlo: mcRes, cores: (await import('node:os')).cpus().length,
  };
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { if (child?.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ } } });
