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

// ---------------------------------------------------------------------------
// Categorical (N-outcome) LMSR
//
// Same rule generalized to any number of mutually exclusive outcomes. State is
// an array of share quantities q[] plus b. Cost C(q) = b·ln(Σ e^(q_j/b));
// price of outcome i is the softmax e^(q_i/b) / Σ e^(q_j/b). Buying outcome i
// changes only q_i. The binary functions above are the two-outcome special
// case (q = [qYes, qNo]) and stay in use for existing binary markets.
// ---------------------------------------------------------------------------

/** ln(Σ e^(x_j)) computed stably over an array. */
export function logSumExpArr(xs: number[]): number {
  const m = Math.max(...xs);
  if (!Number.isFinite(m)) return m;
  let sum = 0;
  for (const x of xs) sum += Math.exp(x - m);
  return m + Math.log(sum);
}

/** LMSR cost C(q) for an N-outcome market. */
export function costN(q: number[], b: number): number {
  return b * logSumExpArr(q.map((x) => x / b));
}

/** Prices (probabilities) for every outcome; sums to 1. */
export function pricesN(q: number[], b: number): number[] {
  const scaled = q.map((x) => x / b);
  const lse = logSumExpArr(scaled);
  return scaled.map((s) => Math.exp(s - lse));
}

/** Cost of trading `shares` of outcome `i` (positive = buy, negative = sell). */
export function costOfTradeN(q: number[], b: number, i: number, shares: number): number {
  const after = q.slice();
  after[i] += shares;
  return costN(after, b) - costN(q, b);
}

/**
 * Shares of outcome `i` a spend of `amount` buys (closed form).
 *
 * Solving C(q + d·e_i) − C(q) = amount gives
 *   d = b·[ ln(e^(amount/b)·S − R) − q_i/b ],  S = Σ e^(q_j/b),  R = S − e^(q_i/b)
 * evaluated in log space for stability.
 */
export function sharesForSpendN(q: number[], b: number, i: number, amount: number): number {
  if (amount <= 0) return 0;
  const scaled = q.map((x) => x / b);
  const si = scaled[i];
  const lse = logSumExpArr(scaled); // ln S
  const others = scaled.filter((_, j) => j !== i);
  const lnR = others.length ? logSumExpArr(others) : -Infinity; // ln R
  const A = amount / b + lse; // ln(e^(amount/b)·S)
  // ln(e^A − R): with a single outcome R = 0, so this is just A.
  const lnDiff = lnR === -Infinity ? A : A + Math.log1p(-Math.exp(lnR - A));
  return b * (lnDiff - si);
}

export interface TradeResultN {
  shares: number;
  cost: number;
  newQ: number[];
  pricesAfter: number[];
}

/** Buy shares of outcome `i` by spending `amount`. */
export function buyN(q: number[], b: number, i: number, amount: number): TradeResultN {
  if (!(amount > 0)) throw new Error("Spend amount must be positive");
  const shares = sharesForSpendN(q, b, i, amount);
  const newQ = q.slice();
  newQ[i] += shares;
  return { shares, cost: amount, newQ, pricesAfter: pricesN(newQ, b) };
}

/** Sell `shares` of outcome `i`, receiving currency back. */
export function sellN(q: number[], b: number, i: number, shares: number): TradeResultN {
  if (!(shares > 0)) throw new Error("Shares to sell must be positive");
  const proceeds = -costOfTradeN(q, b, i, -shares);
  const newQ = q.slice();
  newQ[i] -= shares;
  return { shares: -shares, cost: -proceeds, newQ, pricesAfter: pricesN(newQ, b) };
}

/** Max subsidy for an N-outcome market: b·ln(N). */
export function maxSubsidyN(b: number, n: number): number {
  return b * Math.log(n);
}
