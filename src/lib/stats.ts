import { probYes } from "./lmsr";
import { pricedOutcomes, type OutcomeLike } from "./market";

export const START_BALANCE = 1000;

interface MarketForValue {
  kind: string;
  qYes: number;
  qNo: number;
  liquidityB: number;
  resolution: string | null;
  outcomes: OutcomeLike[];
}

/**
 * Current mark-to-market value of one open position. Resolved markets have
 * their positions zeroed on payout, so they contribute nothing here.
 */
export function positionValue(pos: { outcome: string; shares: number; market: MarketForValue }): number {
  const m = pos.market;
  if (m.resolution) return 0;
  if (m.kind === "CATEGORICAL") {
    const price = pricedOutcomes(m.outcomes, m.liquidityB).find((o) => o.id === pos.outcome)?.price ?? 0;
    return pos.shares * price;
  }
  const p = probYes({ qYes: m.qYes, qNo: m.qNo, b: m.liquidityB });
  return pos.shares * (pos.outcome === "YES" ? p : 1 - p);
}

/** Total mark-to-market value of a set of open positions. */
export function openPositionsValue(
  positions: { outcome: string; shares: number; market: MarketForValue }[]
): number {
  return positions.reduce((sum, p) => sum + positionValue(p), 0);
}
