import { describe, expect, it } from "vitest";
import {
  buy,
  buyN,
  cost,
  costN,
  costOfTrade,
  costOfTradeN,
  maxSubsidy,
  maxSubsidyN,
  pricesN,
  probYes,
  sell,
  sellN,
  sharesForSpend,
  sharesForSpendN,
  type MarketState,
} from "./lmsr";

const fresh = (b = 100): MarketState => ({ qYes: 0, qNo: 0, b });

describe("probYes", () => {
  it("is 0.5 for a fresh market", () => {
    expect(probYes(fresh())).toBeCloseTo(0.5, 12);
  });

  it("rises when YES shares are bought and stays in (0, 1)", () => {
    const { newState } = buy(fresh(), "YES", 50);
    const p = probYes(newState);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(1);
  });

  it("is symmetric: YES prob after YES buy mirrors NO prob after NO buy", () => {
    const yes = buy(fresh(), "YES", 40).newState;
    const no = buy(fresh(), "NO", 40).newState;
    expect(probYes(yes)).toBeCloseTo(1 - probYes(no), 12);
  });

  it("is numerically stable at extreme share imbalances", () => {
    const p = probYes({ qYes: 1e6, qNo: 0, b: 100 });
    expect(p).toBeGreaterThan(0.999999);
    expect(p).toBeLessThanOrEqual(1);
    expect(Number.isFinite(cost({ qYes: 1e6, qNo: 0, b: 100 }))).toBe(true);
  });
});

describe("sharesForSpend / costOfTrade inverse identity", () => {
  it("costOfTrade(sharesForSpend(s)) === s", () => {
    for (const state of [fresh(), { qYes: 300, qNo: 120, b: 75 }]) {
      for (const amount of [1, 10, 250]) {
        const shares = sharesForSpend(state, "YES", amount);
        expect(costOfTrade(state, "YES", shares)).toBeCloseTo(amount, 8);
      }
    }
  });

  it("buying yields more shares than the spend when price < 1 payoff", () => {
    // At p=0.5, 10 currency should buy ~19.6 shares (avg price just over 0.5)
    const shares = sharesForSpend(fresh(), "YES", 10);
    expect(shares).toBeGreaterThan(10);
    expect(shares).toBeLessThan(20);
  });

  it("returns 0 shares for zero or negative spend", () => {
    expect(sharesForSpend(fresh(), "YES", 0)).toBe(0);
    expect(sharesForSpend(fresh(), "YES", -5)).toBe(0);
  });
});

describe("buy/sell round trip", () => {
  it("selling everything bought returns the spend (path independence)", () => {
    const spend = 37;
    const bought = buy(fresh(), "YES", spend);
    const sold = sell(bought.newState, "YES", bought.shares);
    expect(-sold.cost).toBeCloseTo(spend, 8);
    expect(probYes(sold.newState)).toBeCloseTo(0.5, 10);
  });

  it("selling moves the price against the seller", () => {
    const bought = buy(fresh(), "YES", 100);
    const sold = sell(bought.newState, "YES", bought.shares / 2);
    expect(sold.probAfter).toBeLessThan(bought.probAfter);
    expect(sold.probAfter).toBeGreaterThan(0.5);
  });

  it("rejects non-positive inputs", () => {
    expect(() => buy(fresh(), "YES", 0)).toThrow();
    expect(() => sell(fresh(), "YES", -1)).toThrow();
  });
});

describe("market maker subsidy bound", () => {
  it("worst-case loss never exceeds b*ln(2)", () => {
    // Drive the market hard toward YES, then resolve YES:
    // maker collected `spend` and owes `shares`; loss = shares - spend <= b ln 2
    const b = 100;
    let state = fresh(b);
    let collected = 0;
    let owed = 0;
    for (let i = 0; i < 50; i++) {
      const r = buy(state, "YES", 200);
      collected += r.cost;
      owed += r.shares;
      state = r.newState;
    }
    expect(owed - collected).toBeLessThanOrEqual(maxSubsidy(b) + 1e-6);
    expect(owed - collected).toBeGreaterThan(0.99 * maxSubsidy(b)); // nearly saturated
  });
});

describe("N-outcome LMSR", () => {
  it("prices are uniform for a fresh market and sum to 1", () => {
    const prices = pricesN([0, 0, 0, 0], 100);
    for (const p of prices) expect(p).toBeCloseTo(0.25, 12);
    expect(prices.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("prices always sum to 1 after trading", () => {
    const { newQ } = buyN([0, 0, 0], 100, 1, 150);
    const prices = pricesN(newQ, 100);
    expect(prices.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(prices[1]).toBeGreaterThan(prices[0]); // bought outcome leads
  });

  it("matches the binary engine when N = 2", () => {
    const b = 100;
    const binary = buy({ qYes: 30, qNo: 10, b }, "YES", 25);
    const nAry = buyN([30, 10], b, 0, 25);
    expect(nAry.shares).toBeCloseTo(binary.shares, 9);
    expect(nAry.pricesAfter[0]).toBeCloseTo(binary.probAfter, 9);
    expect(costN([30, 10], b)).toBeCloseTo(cost({ qYes: 30, qNo: 10, b }), 9);
  });

  it("costOfTradeN(sharesForSpendN(s)) === s", () => {
    const q = [40, 10, 25];
    for (const amount of [1, 20, 300]) {
      const shares = sharesForSpendN(q, 80, 2, amount);
      expect(costOfTradeN(q, 80, 2, shares)).toBeCloseTo(amount, 8);
    }
  });

  it("buy then sell the same shares is a no-op round trip", () => {
    const q = [0, 0, 0, 0];
    const bought = buyN(q, 100, 2, 60);
    const sold = sellN(bought.newQ, 100, 2, bought.shares);
    expect(-sold.cost).toBeCloseTo(60, 8);
    for (const p of pricesN(sold.newQ, 100)) expect(p).toBeCloseTo(0.25, 9);
  });

  it("worst-case loss on N outcomes never exceeds b·ln(N)", () => {
    const b = 100;
    let q = [0, 0, 0, 0, 0];
    let collected = 0;
    let owed = 0;
    for (let k = 0; k < 60; k++) {
      const r = buyN(q, b, 3, 300);
      collected += r.cost;
      owed += r.shares;
      q = r.newQ;
    }
    expect(owed - collected).toBeLessThanOrEqual(maxSubsidyN(b, 5) + 1e-6);
    expect(owed - collected).toBeGreaterThan(0.99 * maxSubsidyN(b, 5));
  });
});
