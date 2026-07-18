/**
 * One-off economy reset (keeps all markets & outcomes intact):
 *   • Clears every bet — deletes all Trade and Position rows.
 *   • Resets every user's balance to the ₱1000 starting cash.
 *   • Re-opens every market at even odds: share quantities q are zeroed and
 *     liquidity is set to NEW_B, so buttons, headline, and the history chart
 *     all agree.
 *
 * Why zero q (rather than preserve odds by scaling)? Prices are tracked two
 * ways that must stay in lockstep: the stored Outcome.q (used by the trade
 * panel + headline) and a replay of the Trade ledger from q=0 (used by the
 * match/history chart). That invariant only holds when stored q equals the
 * sum of a market's trades. Clearing trades therefore requires zeroing q too —
 * otherwise the chart (ledger replay) and the buttons (stored q) diverge.
 * A fresh market opens 50/50 (or 1/N) and moves as people trade.
 *
 * Unlike `seed.ts`, this does NOT drop markets/outcomes/comments, so any
 * markets you created in the app (and edits like added outcomes) survive.
 *
 * Run with: npx tsx prisma/reset.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_B = 5000;
const START_BALANCE = 1000;

async function main() {
  // 1. Wipe all betting activity.
  const { count: tradesCleared } = await prisma.trade.deleteMany();
  const { count: positionsCleared } = await prisma.position.deleteMany();

  // 2. Everyone back to the starting stake.
  const { count: usersReset } = await prisma.user.updateMany({
    data: { balance: START_BALANCE },
  });

  // 3. Re-open every market at even odds with the new liquidity depth.
  //    Zeroing q keeps stored-q and the (now empty) trade ledger consistent.
  const marketsReset = await prisma.market.updateMany({
    data: {
      liquidityB: NEW_B,
      qYes: 0,
      qNo: 0,
      volume: 0,
      // Clear any resolution / optimistic-oracle state back to a fresh open market.
      resolution: null,
      resolvedAt: null,
      proposedOutcome: null,
      proposedById: null,
      proposedAt: null,
      challengeUntil: null,
      disputed: false,
      disputedById: null,
      proposerBond: 0,
      disputerBond: 0,
    },
  });
  const outcomesReset = await prisma.outcome.updateMany({ data: { q: 0 } });

  console.log(
    `Reset done: ${usersReset} users → ₱${START_BALANCE}, cleared ${tradesCleared} trades / ` +
      `${positionsCleared} positions, opened ${marketsReset.count} markets at even odds ` +
      `(b=${NEW_B}, ${outcomesReset.count} outcomes zeroed).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
