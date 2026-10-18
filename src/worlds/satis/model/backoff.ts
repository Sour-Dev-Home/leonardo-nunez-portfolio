/**
 * Retry waits, as the agent computes them (agent/src/backoff.ts in Sour-Dev-Home/satisfactory-dash):
 * exponential from `base`, capped at `max`, then "equal jitter" — half the ceiling fixed, half random —
 * so agents that lost the backend together don't come back together. Units are the caller's (the figure
 * uses scaled seconds; the agent uses 1 s → 60 s).
 */
export function backoffDelay(attempt: number, base: number, max: number, random: () => number): number {
  const exponent = Number.isFinite(attempt) ? Math.min(Math.max(0, Math.floor(attempt)), 30) : 0;
  const ceiling = Math.min(max, base * 2 ** exponent);
  return ceiling / 2 + random() * (ceiling / 2);
}
