import type { Prisma } from "@prisma/client";
import { formatMoney } from "./format";
import { notify } from "./notify";

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
  const href = `/markets/${marketId}`;
  const market = await tx.market.findUnique({
    where: { id: marketId },
    select: { question: true },
  });
  const question = market?.question ?? "A market";

  // Everyone with an open position (any outcome) gets a resolution notice; the
  // winners get paid their shares (each winning share pays 1 currency unit).
  const positions = await tx.position.findMany({
    where: { marketId, shares: { gt: 1e-9 } },
  });
  for (const p of positions) {
    if (p.outcome === winningKey) {
      await tx.user.update({
        where: { id: p.userId },
        data: { balance: { increment: p.shares } },
      });
      await notify(
        tx,
        p.userId,
        "RESOLVED",
        `You won ${formatMoney(p.shares)} on "${question}"`,
        href
      );
    } else {
      await notify(tx, p.userId, "RESOLVED", `"${question}" resolved — better luck next time`, href);
    }
  }

  await tx.position.updateMany({ where: { marketId }, data: { shares: 0 } });
  await tx.market.update({
    where: { id: marketId },
    data: { resolution: winningKey, resolvedAt: new Date() },
  });

  // Any resting limit orders on this market can never fill now.
  await tx.limitOrder.updateMany({
    where: { marketId, status: "OPEN" },
    data: { status: "CANCELLED" },
  });

  await settleCombosForMarket(tx, marketId, winningKey);
}

/**
 * Mark every pending combo leg on this market won/lost, then settle any combo
 * whose fate is now decided: one losing leg loses the whole parlay; all legs
 * winning pays out `payout` (stake / combinedProb) to the owner.
 */
async function settleCombosForMarket(
  tx: Prisma.TransactionClient,
  marketId: string,
  winningKey: string
): Promise<void> {
  const legs = await tx.comboLeg.findMany({
    where: { marketId, result: "PENDING" },
    select: { id: true, comboId: true, outcome: true },
  });
  if (legs.length === 0) return;

  const affected = new Set<string>();
  for (const leg of legs) {
    const won = leg.outcome === winningKey;
    await tx.comboLeg.update({
      where: { id: leg.id },
      data: { result: won ? "WON" : "LOST" },
    });
    affected.add(leg.comboId);
  }

  for (const comboId of affected) {
    const combo = await tx.combo.findUnique({
      where: { id: comboId },
      include: { legs: true },
    });
    if (!combo || combo.status !== "OPEN") continue;

    if (combo.legs.some((l) => l.result === "LOST")) {
      await tx.combo.update({
        where: { id: comboId },
        data: { status: "LOST", settledAt: new Date() },
      });
      await notify(
        tx,
        combo.userId,
        "COMBO",
        `Your ${combo.legs.length}-leg combo missed — a leg resolved against you`,
        "/combos"
      );
    } else if (combo.legs.every((l) => l.result === "WON")) {
      await tx.user.update({
        where: { id: combo.userId },
        data: { balance: { increment: combo.payout } },
      });
      await tx.combo.update({
        where: { id: comboId },
        data: { status: "WON", settledAt: new Date() },
      });
      await notify(
        tx,
        combo.userId,
        "COMBO",
        `🎉 Your ${combo.legs.length}-leg combo hit! Paid ${formatMoney(combo.payout)}`,
        "/combos"
      );
    }
  }
}

// Re-exported so callers can settle combos referencing a market that was
// resolved through a path other than payoutWinners, if ever needed.
export { settleCombosForMarket };

