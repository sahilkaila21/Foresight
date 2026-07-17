/**
 * Adds the Spain vs Argentina World Cup market to the current DB without
 * wiping existing data (unlike seed.ts). Safe to re-run: no-ops if the
 * market already exists.
 *
 * Run with: npx tsx prisma/add-world-cup.ts
 */
import { PrismaClient } from "@prisma/client";
import { buyN } from "../src/lib/lmsr";

const prisma = new PrismaClient();

const QUESTION = "Spain vs Argentina — who wins?";

async function tradeCategorical(userId: string, marketId: string, outcomeIdx: number, spend: number) {
  const market = await prisma.market.findUniqueOrThrow({
    where: { id: marketId },
    include: { outcomes: true },
  });
  const sorted = [...market.outcomes].sort((a, z) => a.sortOrder - z.sortOrder);
  const q = sorted.map((o) => o.q);
  const r = buyN(q, market.liquidityB, outcomeIdx, spend);
  const outcome = sorted[outcomeIdx].id;
  await prisma.$transaction([
    prisma.outcome.update({ where: { id: outcome }, data: { q: r.newQ[outcomeIdx] } }),
    prisma.market.update({ where: { id: marketId }, data: { volume: { increment: spend } } }),
    prisma.user.update({ where: { id: userId }, data: { balance: { decrement: spend } } }),
    prisma.position.upsert({
      where: { userId_marketId_outcome: { userId, marketId, outcome } },
      create: { userId, marketId, outcome, shares: r.shares },
      update: { shares: { increment: r.shares } },
    }),
    prisma.trade.create({
      data: {
        marketId,
        userId,
        outcome,
        shares: r.shares,
        cost: spend,
        probAfter: r.pricesAfter[outcomeIdx],
      },
    }),
  ]);
}

async function main() {
  const existing = await prisma.market.findFirst({ where: { question: QUESTION } });
  if (existing) {
    console.log(`Already exists: "${QUESTION}" (${existing.id})`);
    return;
  }

  const alice = await prisma.user.findUnique({ where: { username: "alice" } });
  const bob = await prisma.user.findUnique({ where: { username: "bob" } });
  if (!alice || !bob) {
    throw new Error("Demo users alice/bob not found — run `npm run db:seed` first.");
  }

  const labels = ["Spain", "Argentina", "Draw"];
  const market = await prisma.market.create({
    data: {
      question: QUESTION,
      description:
        "World Cup match, Spain vs Argentina. Resolves to the team that wins in regulation/extra time/penalties per FIFA's official match result, or Draw if the official result is a tie (group-stage draw).",
      kind: "CATEGORICAL",
      category: "World Cup",
      closesAt: new Date("2026-07-19T19:00:00Z"),
      creatorId: alice.id,
      outcomes: { create: labels.map((label, i) => ({ label, sortOrder: i })) },
    },
  });
  await tradeCategorical(bob.id, market.id, 0, 140); // Spain
  await tradeCategorical(alice.id, market.id, 1, 95); // Argentina
  await tradeCategorical(bob.id, market.id, 2, 20); // Draw

  console.log(`Created "${QUESTION}" (${market.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
