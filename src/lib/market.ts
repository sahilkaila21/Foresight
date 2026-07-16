import { pricesN, probYes } from "./lmsr";

export interface OutcomeLike {
  id: string;
  label: string;
  q: number;
  sortOrder: number;
}

/** Outcomes sorted by their display order with each one's current price attached. */
export function pricedOutcomes<T extends OutcomeLike>(
  outcomes: T[],
  b: number
): (T & { price: number })[] {
  const sorted = [...outcomes].sort((a, z) => a.sortOrder - z.sortOrder);
  const prices = pricesN(
    sorted.map((o) => o.q),
    b
  );
  return sorted.map((o, i) => ({ ...o, price: prices[i] }));
}

/**
 * A single "headline" probability + label for a market, for compact list rows.
 * Binary → YES price; categorical → the leading outcome.
 */
export function marketHeadline(market: {
  kind: string;
  qYes: number;
  qNo: number;
  liquidityB: number;
  outcomes: OutcomeLike[];
}): { label: string; prob: number } {
  if (market.kind === "CATEGORICAL") {
    const priced = pricedOutcomes(market.outcomes, market.liquidityB);
    const leader = priced.reduce((best, o) => (o.price > best.price ? o : best), priced[0]);
    return leader ? { label: leader.label, prob: leader.price } : { label: "—", prob: 0 };
  }
  return {
    label: "YES",
    prob: probYes({ qYes: market.qYes, qNo: market.qNo, b: market.liquidityB }),
  };
}
