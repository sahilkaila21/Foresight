import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { probYes } from "@/lib/lmsr";
import { pricedOutcomes } from "@/lib/market";
import { getSessionUserId } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      creator: { select: { username: true } },
      outcomes: true,
      trades: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { username: true } } },
      },
    },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

  const userId = await getSessionUserId();
  const positions = userId
    ? await prisma.position.findMany({
        where: { userId, marketId: id, shares: { gt: 0 } },
      })
    : [];

  const isCat = market.kind === "CATEGORICAL";

  return NextResponse.json({
    id: market.id,
    question: market.question,
    description: market.description,
    kind: market.kind,
    closesAt: market.closesAt,
    resolution: market.resolution,
    resolvedAt: market.resolvedAt,
    liquidityB: market.liquidityB,
    qYes: market.qYes,
    qNo: market.qNo,
    creator: market.creator.username,
    isCreator: userId === market.creatorId,
    createdAt: market.createdAt,
    probYes: isCat ? undefined : probYes({ qYes: market.qYes, qNo: market.qNo, b: market.liquidityB }),
    outcomes: isCat
      ? pricedOutcomes(market.outcomes, market.liquidityB).map((o) => ({
          id: o.id,
          label: o.label,
          prob: o.price,
        }))
      : undefined,
    trades: market.trades.map((t) => ({
      id: t.id,
      username: t.user.username,
      outcome: t.outcome,
      shares: t.shares,
      cost: t.cost,
      probAfter: t.probAfter,
      createdAt: t.createdAt,
    })),
    myPositions: positions.map((p) => ({ outcome: p.outcome, shares: p.shares })),
  });
}
