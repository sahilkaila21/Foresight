/**
 * LMSR (Logarithmic Market Scoring Rule) automated market maker for binary markets.
 *
 * State: outstanding share quantities (qYes, qNo) and liquidity parameter b.
 * Cost function C(q) = b * ln(e^(qYes/b) + e^(qNo/b)).
 * A trade of d shares on one outcome costs C(after) - C(before).
 * Each winning share pays out 1 currency unit at resolution.
 *
 * All exponentials go through log-sum-exp so extreme q values don't overflow.
 */

export type Outcome = "YES" | "NO";

export interface MarketState {
  qYes: number;
  qNo: number;
  b: number;
}

/** ln(e^x + e^y) computed stably. */
function logSumExp(x: number, y: number): number {
  const m = Math.max(x, y);
  return m + Math.log(Math.exp(x - m) + Math.exp(y - m));
}

/** LMSR cost function C(q). */
export function cost({ qYes, qNo, b }: MarketState): number {
  return b * logSumExp(qYes / b, qNo / b);
}

/** Instantaneous probability (= price) of the YES outcome, in (0, 1). */
export function probYes({ qYes, qNo, b }: MarketState): number {
  // sigmoid((qYes - qNo) / b), stable for large |x|
  const x = (qYes - qNo) / b;
  return x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
}

export function probability(state: MarketState, outcome: Outcome): number {
  const p = probYes(state);
  return outcome === "YES" ? p : 1 - p;
}

function withShares(state: MarketState, outcome: Outcome, delta: number): MarketState {
  return {
    qYes: state.qYes + (outcome === "YES" ? delta : 0),
    qNo: state.qNo + (outcome === "NO" ? delta : 0),
    b: state.b,
  };
}

/**
 * Cost of trading `shares` of `outcome` (positive = buy, negative = sell).
 * Positive result = trader pays; negative = trader receives.
 */
export function costOfTrade(state: MarketState, outcome: Outcome, shares: number): number {
  return cost(withShares(state, outcome, shares)) - cost(state);
}

/**
 * How many shares of `outcome` a spend of `amount` buys (closed form).
 *
 * Solves C(q + d·e_o) - C(q) = amount for d:
 *   d = b * ln( ((e^(qo/b) + e^(qother/b)) * e^(amount/b) - e^(qother/b)) / e^(qo/b) )
 * computed in log space for stability.
 */
export function sharesForSpend(state: MarketState, outcome: Outcome, amount: number): number {
  if (amount <= 0) return 0;
  const { b } = state;
  const qo = (outcome === "YES" ? state.qYes : state.qNo) / b;
  const qx = (outcome === "NO" ? state.qYes : state.qNo) / b;
  const total = logSumExp(qo, qx); // ln(e^qo + e^qx)
  // ln(e^(total + amount/b) - e^qx), stable since total + amount/b > qx
  const big = total + amount / b;
  const inner = big + Math.log1p(-Math.exp(qx - big));
  return b * (inner - qo);
}

/** Result of applying a trade to a market. */
export interface TradeResult {
  shares: number; // shares traded (positive = bought, negative = sold)
  cost: number; // currency moved (positive = user paid, negative = user received)
  newState: MarketState;
  probAfter: number;
}

/** Buy shares of `outcome` by spending `amount` currency. */
export function buy(state: MarketState, outcome: Outcome, amount: number): TradeResult {
  if (!(amount > 0)) throw new Error("Spend amount must be positive");
  const shares = sharesForSpend(state, outcome, amount);
  const newState = withShares(state, outcome, shares);
  return { shares, cost: amount, newState, probAfter: probYes(newState) };
}

/** Sell `shares` of `outcome`, receiving currency back from the market maker. */
export function sell(state: MarketState, outcome: Outcome, shares: number): TradeResult {
  if (!(shares > 0)) throw new Error("Shares to sell must be positive");
  const proceeds = -costOfTrade(state, outcome, -shares); // positive number
  const newState = withShares(state, outcome, -shares);
  return { shares: -shares, cost: -proceeds, newState, probAfter: probYes(newState) };
}

/** Max the market maker can lose on a binary market (its liquidity subsidy). */
export function maxSubsidy(b: number): number {
  return b * Math.LN2;
}
