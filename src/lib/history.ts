/** Helpers for probability-over-time: 24h change and time-range filtering. */

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface TradePoint {
  createdAt: Date | string;
  probAfter: number;
}

/**
 * Probability of an outcome as of `cutoff` (epoch ms): the `probAfter` of the
 * last trade at or before the cutoff, or the opening probability if there were
 * none yet. `trades` must be ascending by time.
 */
export function probAt(trades: TradePoint[], cutoff: number, opening = 0.5): number {
  let p = opening;
  for (const t of trades) {
    if (new Date(t.createdAt).getTime() <= cutoff) p = t.probAfter;
    else break;
  }
  return p;
}

/**
 * Signed change in an outcome's probability over the last 24h (current minus
 * 24h-ago), as a fraction. Null when there's no meaningful history to compare.
 */
export function change24h(
  trades: TradePoint[],
  currentProb: number,
  opening = 0.5
): number | null {
  if (trades.length === 0) return null;
  const past = probAt(trades, Date.now() - DAY_MS, opening);
  const delta = currentProb - past;
  return Math.abs(delta) < 1e-4 ? 0 : delta;
}

export type Range = "1D" | "1W" | "1M" | "ALL";

export const RANGE_MS: Record<Exclude<Range, "ALL">, number> = {
  "1D": DAY_MS,
  "1W": 7 * DAY_MS,
  "1M": 30 * DAY_MS,
};

/**
 * Keep only points within `range` of the latest point, always retaining one
 * anchor point at/just before the window start so the line doesn't begin in
 * mid-air. `points` must be ascending by `t`.
 */
export function clipToRange<T extends { t: number }>(points: T[], range: Range): T[] {
  if (range === "ALL" || points.length < 2) return points;
  const end = points[points.length - 1].t;
  const start = end - RANGE_MS[range];
  const inWindow = points.filter((p) => p.t >= start);
  if (inWindow.length === points.length) return points;
  // Anchor: last point before the window, flattened to the window start.
  const beforeIdx = points.findIndex((p) => p.t >= start) - 1;
  if (beforeIdx >= 0) {
    return [{ ...points[beforeIdx], t: start }, ...inWindow];
  }
  return inWindow.length >= 2 ? inWindow : points;
}
