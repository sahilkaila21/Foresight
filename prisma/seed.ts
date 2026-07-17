/**
 * Seed the app with exactly two FIFA World Cup match markets and nothing else:
 *
 *   • Spain vs Argentina — who wins?
 *   • England vs France — who wins?
 *
 * Both are categorical (Team A / Team B / Draw). A handful of trades are run
 * through the real LMSR engine so opening prices aren't flat. Demo users
 * alice / bob / admin (password "password123") are kept for seeding trades and
 * for admin resolution; real testers just sign up fresh.
 *
 * Wipes ALL existing market data first, so it's the single source of truth for
 * a clean two-market slate. Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buyN, pricesN } from "../src/lib/lmsr";

const prisma = new PrismaClient();

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
  // Clean slate — wipe every market and all related data.
  await prisma.comment.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.position.deleteMany();
  await prisma.outcome.deleteMany();
  await prisma.market.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);
  const alice = await prisma.user.upsert({
    where: { username: "alice" },
    update: { balance: 1000 },
    create: { username: "alice", passwordHash },
  });
  const bob = await prisma.user.upsert({
    where: { username: "bob" },
    update: { balance: 1000 },
    create: { username: "bob", passwordHash },
  });
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { balance: 1000, isAdmin: true },
    create: { username: "admin", passwordHash, isAdmin: true },
  });

  async function createMatch(teamA: string, teamB: string, closesAt: Date) {
    const labels = [teamA, teamB, "Draw"];
    return prisma.market.create({
      data: {
        question: `${teamA} vs ${teamB} — who wins?`,
        description:
          `World Cup match, ${teamA} vs ${teamB}. Resolves to the team that wins in ` +
          `regulation/extra time/penalties per FIFA's official match result, or Draw if the ` +
          `official result is a tie (group-stage draw).`,
        kind: "CATEGORICAL",
        category: "World Cup",
        closesAt,
        creatorId: alice.id,
        outcomes: { create: labels.map((label, i) => ({ label, sortOrder: i })) },
      },
    });
  }

  // Two future matches.
  const spainArg = await createMatch("Spain", "Argentina", new Date("2026-07-19T19:00:00Z"));
  await tradeCategorical(bob.id, spainArg.id, 0, 140); // Spain
  await tradeCategorical(alice.id, spainArg.id, 1, 95); // Argentina
  await tradeCategorical(bob.id, spainArg.id, 2, 20); // Draw

  const engFra = await createMatch("England", "France", new Date("2026-07-22T19:00:00Z"));
  await tradeCategorical(alice.id, engFra.id, 1, 120); // France
  await tradeCategorical(bob.id, engFra.id, 0, 85); // England
  await tradeCategorical(alice.id, engFra.id, 2, 20); // Draw

  for (const m of [spainArg, engFra]) {
    const f = await prisma.market.findUniqueOrThrow({ where: { id: m.id }, include: { outcomes: true } });
    const sorted = [...f.outcomes].sort((a, z) => a.sortOrder - z.sortOrder);
    const prices = pricesN(sorted.map((o) => o.q), f.liquidityB);
    console.log(
      `  ${f.question} → ${sorted.map((o, i) => `${o.label} ${Math.round(prices[i] * 100)}%`).join(", ")}`
    );
  }
  console.log("Seeded: alice, bob & admin (password 'password123') + 2 World Cup match markets.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
