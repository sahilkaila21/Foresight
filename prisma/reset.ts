/**
 * One-off economy reset (keeps all markets & outcomes intact):
 *   • Clears every bet — deletes all Trade and Position rows.
 *   • Resets every user's balance to the ₱1000 starting cash.
 *   • Re-liquidities every market to b = NEW_B. Each market's share
 *     quantities q are scaled by (NEW_B / oldB) so the *current odds are
 *     preserved* (price = softmax(q/b) is invariant under scaling q and b
 *     together) while future trades move the price far less.
 *   • Zeroes each market's volume (bets are gone).
 *
 * Unlike `seed.ts`, this does NOT drop markets/outcomes/comments, so any
 * markets you created in the app (and edits like added outcomes) survive.
 *
 * Run with: npx tsx prisma/reset.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_B = 20000;
const START_BALANCE = 1000;

async function main() {
  // 1. Wipe all betting activity.
  const { count: tradesCleared } = await prisma.trade.deleteMany();
  const { count: positionsCleared } = await prisma.position.deleteMany();

  // 2. Everyone back to the starting stake.
  const { count: usersReset } = await prisma.user.updateMany({
    data: { balance: START_BALANCE },
  });

  // 3. Deepen liquidity on every market, preserving its current odds.
  const markets = await prisma.market.findMany({ include: { outcomes: true } });
  for (const m of markets) {
    const k = NEW_B / m.liquidityB; // scale factor that keeps q/b (the price) fixed
    await prisma.$transaction([
      prisma.market.update({
        where: { id: m.id },
        data: { liquidityB: NEW_B, qYes: m.qYes * k, qNo: m.qNo * k, volume: 0 },
      }),
      ...m.outcomes.map((o) =>
        prisma.outcome.update({ where: { id: o.id }, data: { q: o.q * k } })
      ),
    ]);
  }

  console.log(
    `Reset done: ${usersReset} users → ₱${START_BALANCE}, cleared ${tradesCleared} trades / ` +
      `${positionsCleared} positions, set b=${NEW_B} on ${markets.length} markets (odds preserved).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
