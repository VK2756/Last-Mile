// OWNER: Lane A. Scenario registry: owns each scenario's ticker, fans events out to SSE subscribers,
// expires idle scenarios (TTL), never throws into the event loop.
import { randomUUID } from 'node:crypto';
import { StreamEvent, type Metrics, type ScenarioConfig, type SimFrame, type SimInit } from '@lastmile/contracts';

export interface ScenarioRunner {
  init: SimInit;
  readonly done: boolean;
  /** advance the simulation by dt simulated seconds and return the new frame */
  step(dt: number): SimFrame;
  finalMetrics(): Metrics;
}
export type RunnerFactory = (scenarioId: string, config: ScenarioConfig) => ScenarioRunner;
export type Listener = (ev: StreamEvent) => void;

export const FRAME_INTERVAL_MS = 500;

export class Scenario {
  readonly id: string;
  config: ScenarioConfig;
  paused = false;
  speed: number;
  lastTouched = Date.now();
  private readonly subs = new Set<Listener>();
  private timer: NodeJS.Timeout | null = null;
  private latest: SimFrame | null = null;
  private ended: StreamEvent | null = null;

  constructor(id: string, config: ScenarioConfig, readonly runner: ScenarioRunner) {
    this.id = id; this.config = config; this.speed = config.speedMultiplier;
  }

  private emit(ev: StreamEvent) {
    StreamEvent.parse(ev); // fail loudly if we ever stream something off-contract
    for (const l of [...this.subs]) { try { l(ev); } catch { this.subs.delete(l); } }
  }

  subscribe(l: Listener): () => void {
    this.lastTouched = Date.now();
    l({ type: 'init', init: this.runner.init });
    if (this.latest) l({ type: 'frame', frame: this.latest });
    if (this.ended) { l(this.ended); return () => {}; }
    this.subs.add(l);
    this.ensureTicker();
    return () => { this.subs.delete(l); this.lastTouched = Date.now(); if (!this.subs.size) this.stopTicker(); };
  }

  private ensureTicker() {
    if (this.timer || this.ended) return;
    this.timer = setInterval(() => this.tick(), FRAME_INTERVAL_MS);
  }
  private stopTicker() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  private tick() {
    if (this.paused) return;
    try {
      const frame = this.runner.step((FRAME_INTERVAL_MS / 1000) * this.speed);
      this.latest = frame;
      this.emit({ type: 'frame', frame });
      if (this.runner.done) {
        this.ended = { type: 'end', scenarioId: this.id, final: this.runner.finalMetrics() };
        this.stopTicker();
        this.emit(this.ended);
        this.subs.clear();
      }
    } catch (err) {
      console.error(`[scenario ${this.id}] tick failed`, err);
      this.stopTicker();
    }
  }

  control(action: 'pause' | 'resume' | 'speed', value?: number) {
    this.lastTouched = Date.now();
    if (action === 'pause') this.paused = true;
    else if (action === 'resume') this.paused = false;
    else if (value !== undefined) this.speed = Math.min(60, Math.max(0.25, value));
  }

  dispose() { this.stopTicker(); this.subs.clear(); }
  get subscriberCount() { return this.subs.size; }
}

export class Registry {
  private readonly map = new Map<string, Scenario>();
  private sweeper: NodeJS.Timeout;
  constructor(private readonly factory: RunnerFactory, private readonly ttlMs = 30 * 60_000) {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }
  create(config: ScenarioConfig): Scenario {
    const id = `sc-${randomUUID().slice(0, 8)}`;
    const s = new Scenario(id, config, this.factory(id, config));
    this.map.set(id, s);
    return s;
  }
  get(id: string) { return this.map.get(id); }
  get size() { return this.map.size; }
  sweep(now = Date.now()) {
    for (const [id, s] of this.map) {
      if (s.subscriberCount === 0 && now - s.lastTouched > this.ttlMs) { s.dispose(); this.map.delete(id); }
    }
  }
  close() { clearInterval(this.sweeper); for (const s of this.map.values()) s.dispose(); this.map.clear(); }
}
