/**
 * Adds the "Golden Boot — top scorer" categorical market to the current DB
 * without wiping existing data. Idempotent: no-ops if it already exists.
 *
 * Run with: npx tsx prisma/add-golden-boot.ts
 */
import { PrismaClient } from "@prisma/client";
import { buyN } from "../src/lib/lmsr";

const prisma = new PrismaClient();

const QUESTION = "Golden Boot — top scorer of the World Cup?";
const PLAYERS = ["Mbappé", "Kane", "Yamal", "Álvarez", "Vinícius Jr"];

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
  if (!alice || !bob) throw new Error("Demo users alice/bob not found — run `npm run db:seed` first.");

  const market = await prisma.market.create({
    data: {
      question: QUESTION,
      description:
        "Resolves to the player who finishes as the World Cup's top goalscorer per FIFA's official Golden Boot award (tie-break: most assists, then fewest minutes played).",
      kind: "CATEGORICAL",
      category: "World Cup",
      closesAt: new Date("2026-07-19T19:00:00Z"),
      creatorId: alice.id,
      outcomes: { create: PLAYERS.map((label, i) => ({ label, sortOrder: i })) },
    },
  });
  await tradeCategorical(bob.id, market.id, 0, 120); // Mbappé
  await tradeCategorical(alice.id, market.id, 1, 70); // Kane
  await tradeCategorical(bob.id, market.id, 2, 55); // Yamal
  await tradeCategorical(alice.id, market.id, 3, 40); // Álvarez

  console.log(`Created "${QUESTION}" (${market.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
