import { describe, expect, it } from "vitest";
import { isValidOutcomeKey, marketPhase, type ResolutionState } from "./resolution";

const base: ResolutionState = {
  closesAt: new Date("2026-01-01T00:00:00Z"),
  resolution: null,
  proposedOutcome: null,
  challengeUntil: null,
  disputed: false,
};
const T = base.closesAt.getTime();

describe("marketPhase", () => {
  it("is OPEN before close", () => {
    expect(marketPhase(base, T - 1000)).toBe("OPEN");
  });

  it("is AWAITING_PROPOSAL once closed with no proposal", () => {
    expect(marketPhase(base, T + 1000)).toBe("AWAITING_PROPOSAL");
  });

  it("is IN_CHALLENGE while a proposal's window is open", () => {
    const m = { ...base, proposedOutcome: "YES", challengeUntil: new Date(T + 10000) };
    expect(marketPhase(m, T + 5000)).toBe("IN_CHALLENGE");
  });

  it("is READY_TO_FINALIZE once the window elapses undisputed", () => {
    const m = { ...base, proposedOutcome: "YES", challengeUntil: new Date(T + 10000) };
    expect(marketPhase(m, T + 20000)).toBe("READY_TO_FINALIZE");
  });

  it("is DISPUTED when challenged, regardless of window", () => {
    const m = {
      ...base,
      proposedOutcome: "YES",
      challengeUntil: new Date(T + 10000),
      disputed: true,
    };
    expect(marketPhase(m, T + 5000)).toBe("DISPUTED");
    expect(marketPhase(m, T + 20000)).toBe("DISPUTED");
  });

  it("is RESOLVED once finalized, overriding everything else", () => {
    const m = { ...base, resolution: "YES", disputed: true, proposedOutcome: "NO" };
    expect(marketPhase(m, T + 999999)).toBe("RESOLVED");
  });
});

describe("isValidOutcomeKey", () => {
  const binary = { kind: "BINARY", outcomes: [] };
  const categorical = { kind: "CATEGORICAL", outcomes: [{ id: "a" }, { id: "b" }] };

  it("accepts YES/NO for binary only", () => {
    expect(isValidOutcomeKey(binary, "YES")).toBe(true);
    expect(isValidOutcomeKey(binary, "NO")).toBe(true);
    expect(isValidOutcomeKey(binary, "a")).toBe(false);
  });

  it("accepts known outcome ids for categorical only", () => {
    expect(isValidOutcomeKey(categorical, "a")).toBe(true);
    expect(isValidOutcomeKey(categorical, "z")).toBe(false);
    expect(isValidOutcomeKey(categorical, "YES")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidOutcomeKey(binary, null)).toBe(false);
    expect(isValidOutcomeKey(binary, 3)).toBe(false);
  });
});
