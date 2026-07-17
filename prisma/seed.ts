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
    const labels = [teamA, teamB];
    return prisma.market.create({
      data: {
        question: `${teamA} vs ${teamB} — who wins?`,
        description:
          `World Cup knockout match, ${teamA} vs ${teamB}. Resolves to the team that wins ` +
          `(after extra time / penalties if needed) per FIFA's official match result.`,
        kind: "CATEGORICAL",
        category: "World Cup",
        closesAt,
        creatorId: alice.id,
        outcomes: { create: labels.map((label, i) => ({ label, sortOrder: i })) },
      },
    });
  }

  // Two future matches, each a two-team (Team A / Team B) market.
  const spainArg = await createMatch("Spain", "Argentina", new Date("2026-07-19T19:00:00Z"));
  await tradeCategorical(alice.id, spainArg.id, 1, 150); // Argentina favored
  await tradeCategorical(bob.id, spainArg.id, 0, 95); // Spain

  const engFra = await createMatch("France", "England", new Date("2026-07-18T17:00:00Z"));
  await tradeCategorical(alice.id, engFra.id, 0, 160); // France favored
  await tradeCategorical(bob.id, engFra.id, 1, 80); // England

  // Golden Boot — a multi-player (categorical) award market.
  const goldenBoot = await prisma.market.create({
    data: {
      question: "Golden Boot — top scorer of the World Cup?",
      description:
        "Resolves to the player who finishes as the World Cup's top goalscorer per FIFA's official Golden Boot award (tie-break: most assists, then fewest minutes played).",
      kind: "CATEGORICAL",
      category: "World Cup",
      closesAt: new Date("2026-07-19T19:00:00Z"),
      creatorId: alice.id,
      outcomes: {
        create: ["Mbappé", "Kane", "Yamal", "Álvarez", "Vinícius Jr"].map((label, i) => ({
          label,
          sortOrder: i,
        })),
      },
    },
  });
  await tradeCategorical(bob.id, goldenBoot.id, 0, 120); // Mbappé
  await tradeCategorical(alice.id, goldenBoot.id, 1, 70); // Kane
  await tradeCategorical(bob.id, goldenBoot.id, 2, 55); // Yamal
  await tradeCategorical(alice.id, goldenBoot.id, 3, 40); // Álvarez

  for (const m of [spainArg, engFra, goldenBoot]) {
    const f = await prisma.market.findUniqueOrThrow({ where: { id: m.id }, include: { outcomes: true } });
    const sorted = [...f.outcomes].sort((a, z) => a.sortOrder - z.sortOrder);
    const prices = pricesN(sorted.map((o) => o.q), f.liquidityB);
    console.log(
      `  ${f.question} → ${sorted.map((o, i) => `${o.label} ${Math.round(prices[i] * 100)}%`).join(", ")}`
    );
  }
  console.log(
    "Seeded: alice, bob & admin (password 'password123') + 2 match markets + Golden Boot."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
