/** Simulated seconds since ignition -> "T+12:05" (or "T+1:02:05"). */
export function formatSimClock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `T+${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** Time-to-impact -> "8m 20s" / "45s" / "—" (null = not threatened). */
export function formatTti(tti: number | null | undefined): string {
  if (tti === null || tti === undefined || !Number.isFinite(tti)) return '—';
  const s = Math.max(0, Math.round(tti));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return r === 0 ? `${m}m` : `${m}m ${String(r).padStart(2, '0')}s`;
}

/** 0.8734 -> "87.3%" */
export function formatPct(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

/** Signed percentage points: 0.12 -> "+12.0 pts" */
export function formatPts(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return '—';
  const v = x * 100;
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)} pts`;
}
