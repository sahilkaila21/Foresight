import type { Prisma } from "@prisma/client";

/**
 * Optimistic-oracle resolution.
 *
 * After a market closes, anyone may PROPOSE an outcome (staking a bond). That
 * opens a challenge window; if it elapses unchallenged, anyone may FINALIZE
 * (payout). Anyone may DISPUTE during the window (also bonded), which escalates
 * to an ADMIN who adjudicates and slashes the losing side's bond. This mirrors
 * a UMA-style optimistic oracle and is the natural precursor to on-chain
 * resolution. Admins can also emergency-resolve directly.
 */

export const RESOLUTION_BOND = 50;
export const CHALLENGE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export type Phase =
  | "OPEN" // trading; not yet closed
  | "AWAITING_PROPOSAL" // closed, no proposal yet
  | "IN_CHALLENGE" // proposed, challenge window still open
  | "READY_TO_FINALIZE" // proposed, window elapsed, undisputed
  | "DISPUTED" // challenged, awaiting admin
  | "RESOLVED"; // finalized and paid out

export interface ResolutionState {
  closesAt: Date;
  resolution: string | null;
  proposedOutcome: string | null;
  challengeUntil: Date | null;
  disputed: boolean;
}

export function marketPhase(m: ResolutionState, now: number): Phase {
  if (m.resolution) return "RESOLVED";
  if (m.disputed) return "DISPUTED";
  if (m.proposedOutcome) {
    return m.challengeUntil && now >= m.challengeUntil.getTime()
      ? "READY_TO_FINALIZE"
      : "IN_CHALLENGE";
  }
  return m.closesAt.getTime() <= now ? "AWAITING_PROPOSAL" : "OPEN";
}

/** Whether `key` is a valid winning outcome for this market's kind. */
export function isValidOutcomeKey(
  market: { kind: string; outcomes: { id: string }[] },
  key: unknown
): key is string {
  if (typeof key !== "string") return false;
  return market.kind === "CATEGORICAL"
    ? market.outcomes.some((o) => o.id === key)
    : key === "YES" || key === "NO";
}

/**
 * Pay every winning share 1 currency unit, zero all positions, and stamp the
 * market resolved. Must run inside a transaction.
 */
export async function payoutWinners(
  tx: Prisma.TransactionClient,
  marketId: string,
  winningKey: string
): Promise<void> {
  const winners = await tx.position.findMany({
    where: { marketId, outcome: winningKey, shares: { gt: 0 } },
  });
  for (const p of winners) {
    await tx.user.update({ where: { id: p.userId }, data: { balance: { increment: p.shares } } });
  }
  await tx.position.updateMany({ where: { marketId }, data: { shares: 0 } });
  await tx.market.update({
    where: { id: marketId },
    data: { resolution: winningKey, resolvedAt: new Date() },
  });
}
