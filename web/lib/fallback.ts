// Engine-unreachable fallback: when NEXT_PUBLIC_ENGINE_URL is set but the engine is down or blocked
// (CORS, firewall, mixed content), /live runs the in-browser mock and keeps probing /health.

/** Wait before each health re-check: quick at first, then every 30 s. */
export const ENGINE_RETRY_MS = [5_000, 10_000, 15_000, 30_000] as const;

export function engineRetryDelay(attempt: number): number {
  return ENGINE_RETRY_MS[Math.min(Math.max(0, attempt), ENGINE_RETRY_MS.length - 1)]!;
}
