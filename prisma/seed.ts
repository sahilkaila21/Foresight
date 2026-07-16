/**
 * Seed demo data: two users (alice / bob, password "password123")
 * and a few markets with trades executed through the real LMSR engine
 * so quantities, balances, positions, and the trade ledger stay consistent.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buy, probYes, type Outcome } from "../src/lib/lmsr";

const prisma = new PrismaClient();

async function trade(userId: string, marketId: string, outcome: Outcome, spend: number) {
  const market = await prisma.market.findUniqueOrThrow({ where: { id: marketId } });
  const result = buy({ qYes: market.qYes, qNo: market.qNo, b: market.liquidityB }, outcome, spend);

  await prisma.$transaction([
    prisma.market.update({
      where: { id: marketId },
      data: { qYes: result.newState.qYes, qNo: result.newState.qNo },
    }),
    prisma.user.update({ where: { id: userId }, data: { balance: { decrement: spend } } }),
    prisma.position.upsert({
      where: { userId_marketId_outcome: { userId, marketId, outcome } },
      create: { userId, marketId, outcome, shares: result.shares },
      update: { shares: { increment: result.shares } },
    }),
    prisma.trade.create({
      data: { marketId, userId, outcome, shares: result.shares, cost: spend, probAfter: result.probAfter },
    }),
  ]);
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const alice = await prisma.user.upsert({
    where: { username: "alice" },
    update: {},
    create: { username: "alice", passwordHash },
  });
  const bob = await prisma.user.upsert({
    where: { username: "bob" },
    update: {},
    create: { username: "bob", passwordHash },
  });

  const markets = await Promise.all(
    [
      {
        question: "Will SpaceX land Starship on Mars by end of 2028?",
        description:
          "Resolves YES if a SpaceX Starship vehicle performs a soft landing on the Martian surface before 2029-01-01 UTC, per official SpaceX or NASA confirmation.",
        closesAt: new Date("2028-12-31T23:59:00Z"),
      },
      {
        question: "Will the S&P 500 close above 8,000 before the end of 2026?",
        description: "Resolves YES if any official daily close of the S&P 500 index exceeds 8,000 in 2026.",
        closesAt: new Date("2026-12-31T21:00:00Z"),
      },
      {
        question: "Will it rain in Mumbai on New Year's Day 2027?",
        description: "Resolves YES if IMD records measurable precipitation (≥0.1mm) at Santacruz station on 2027-01-01.",
        closesAt: new Date("2027-01-01T18:00:00Z"),
      },
    ].map((m) => prisma.market.create({ data: { ...m, creatorId: alice.id } }))
  );

  // A few opinionated trades to move prices off 50%
  await trade(alice.id, markets[0].id, "NO", 120);
  await trade(bob.id, markets[0].id, "YES", 40);
  await trade(bob.id, markets[1].id, "YES", 90);
  await trade(alice.id, markets[1].id, "YES", 30);
  await trade(bob.id, markets[2].id, "NO", 60);

  for (const m of markets) {
    const fresh = await prisma.market.findUniqueOrThrow({ where: { id: m.id } });
    console.log(
      `  ${fresh.question} → ${Math.round(probYes({ qYes: fresh.qYes, qNo: fresh.qNo, b: fresh.liquidityB }) * 100)}% YES`
    );
  }
  console.log("Seeded: users alice & bob (password 'password123'), 3 markets, 5 trades.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
