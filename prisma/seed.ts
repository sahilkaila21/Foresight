/**
 * Seed demo data: two users (alice / bob, password "password123") and a few
 * markets — binary and categorical — with trades executed through the real
 * LMSR engine so quantities, balances, positions, and the ledger stay
 * consistent. Wipes market data first so it can be re-run safely.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buy, buyN, pricesN, probYes, type Outcome } from "../src/lib/lmsr";

const prisma = new PrismaClient();

async function tradeBinary(userId: string, marketId: string, outcome: Outcome, spend: number) {
  const market = await prisma.market.findUniqueOrThrow({ where: { id: marketId } });
  const r = buy({ qYes: market.qYes, qNo: market.qNo, b: market.liquidityB }, outcome, spend);
  await prisma.$transaction([
    prisma.market.update({
      where: { id: marketId },
      data: { qYes: r.newState.qYes, qNo: r.newState.qNo, volume: { increment: spend } },
    }),
    prisma.user.update({ where: { id: userId }, data: { balance: { decrement: spend } } }),
    prisma.position.upsert({
      where: { userId_marketId_outcome: { userId, marketId, outcome } },
      create: { userId, marketId, outcome, shares: r.shares },
      update: { shares: { increment: r.shares } },
    }),
    prisma.trade.create({
      data: { marketId, userId, outcome, shares: r.shares, cost: spend, probAfter: r.probAfter },
    }),
  ]);
}

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
  // Clean slate for market data (users are upserted and their balances reset).
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

  const binaries = await Promise.all(
    [
      {
        question: "Will SpaceX land Starship on Mars by end of 2028?",
        description:
          "Resolves YES if a SpaceX Starship vehicle performs a soft landing on the Martian surface before 2029-01-01 UTC, per official SpaceX or NASA confirmation.",
        category: "Science",
        closesAt: new Date("2028-12-31T23:59:00Z"),
      },
      {
        question: "Will the S&P 500 close above 8,000 before the end of 2026?",
        description: "Resolves YES if any official daily close of the S&P 500 index exceeds 8,000 in 2026.",
        category: "Economics",
        closesAt: new Date("2026-12-31T21:00:00Z"),
      },
      {
        question: "Will it rain in Mumbai on New Year's Day 2027?",
        description: "Resolves YES if IMD records measurable precipitation (≥0.1mm) at Santacruz station on 2027-01-01.",
        category: "Science",
        closesAt: new Date("2027-01-01T18:00:00Z"),
      },
      {
        question: "Will Bitcoin close above $150,000 at any point in 2026?",
        description: "Resolves YES if BTC/USD prints above 150,000 on a major exchange during 2026.",
        category: "Crypto",
        closesAt: new Date("2026-12-31T23:59:00Z"),
      },
      {
        question: "Will a sequel be the highest-grossing film of 2027?",
        description: "Resolves YES if the top worldwide box-office film of 2027 is a sequel or franchise entry.",
        category: "Culture",
        closesAt: new Date("2027-12-31T23:59:00Z"),
      },
    ].map((m) => prisma.market.create({ data: { ...m, creatorId: alice.id } }))
  );

  await tradeBinary(alice.id, binaries[0].id, "NO", 120);
  await tradeBinary(bob.id, binaries[0].id, "YES", 40);
  await tradeBinary(bob.id, binaries[1].id, "YES", 90);
  await tradeBinary(alice.id, binaries[1].id, "YES", 30);
  await tradeBinary(bob.id, binaries[2].id, "NO", 60);
  await tradeBinary(bob.id, binaries[3].id, "YES", 200);
  await tradeBinary(alice.id, binaries[3].id, "NO", 45);
  await tradeBinary(alice.id, binaries[4].id, "YES", 25);

  // A categorical (multiple-choice) market.
  const labels = ["Democrat", "Republican", "Independent"];
  const election = await prisma.market.create({
    data: {
      question: "Which party wins the 2028 US presidential election?",
      description: "Resolves to the party of the winning candidate per certified electoral results.",
      kind: "CATEGORICAL",
      category: "Politics",
      closesAt: new Date("2028-11-07T23:59:00Z"),
      creatorId: alice.id,
      outcomes: { create: labels.map((label, i) => ({ label, sortOrder: i })) },
    },
  });
  await tradeCategorical(bob.id, election.id, 0, 80); // Democrat
  await tradeCategorical(alice.id, election.id, 1, 110); // Republican
  await tradeCategorical(bob.id, election.id, 2, 15); // Independent

  for (const m of binaries) {
    const f = await prisma.market.findUniqueOrThrow({ where: { id: m.id } });
    console.log(
      `  ${f.question} → ${Math.round(probYes({ qYes: f.qYes, qNo: f.qNo, b: f.liquidityB }) * 100)}% YES`
    );
  }
  const e = await prisma.market.findUniqueOrThrow({
    where: { id: election.id },
    include: { outcomes: true },
  });
  const sorted = [...e.outcomes].sort((a, z) => a.sortOrder - z.sortOrder);
  const prices = pricesN(
    sorted.map((o) => o.q),
    e.liquidityB
  );
  console.log(
    `  ${e.question} → ${sorted.map((o, i) => `${o.label} ${Math.round(prices[i] * 100)}%`).join(", ")}`
  );
  console.log(
    `Seeded: alice & bob (password 'password123'), ${binaries.length} binary + 1 categorical market.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
