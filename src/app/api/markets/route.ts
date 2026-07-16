import { NextResponse } from "next/server";
import { isCategory } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { probYes } from "@/lib/lmsr";
import { marketHeadline, pricedOutcomes } from "@/lib/market";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const markets = await prisma.market.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { username: true } },
      outcomes: true,
      _count: { select: { trades: true } },
    },
  });

  return NextResponse.json(
    markets.map((m) => {
      const headline = marketHeadline(m);
      return {
        id: m.id,
        question: m.question,
        description: m.description,
        kind: m.kind,
        category: m.category,
        closesAt: m.closesAt,
        resolution: m.resolution,
        resolvedAt: m.resolvedAt,
        creator: m.creator.username,
        createdAt: m.createdAt,
        tradeCount: m._count.trades,
        volume: m.volume,
        // Binary: chance of YES. Categorical: leading outcome + all prices.
        probYes:
          m.kind === "CATEGORICAL"
            ? undefined
            : probYes({ qYes: m.qYes, qNo: m.qNo, b: m.liquidityB }),
        leading: m.kind === "CATEGORICAL" ? { label: headline.label, prob: headline.prob } : undefined,
        outcomes:
          m.kind === "CATEGORICAL"
            ? pricedOutcomes(m.outcomes, m.liquidityB).map((o) => ({
                id: o.id,
                label: o.label,
                prob: o.price,
              }))
            : undefined,
      };
    })
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const closesAt = new Date(body?.closesAt ?? NaN);
  const kind = body?.kind === "CATEGORICAL" ? "CATEGORICAL" : "BINARY";
  const category = isCategory(body?.category) ? body.category : "Other";

  if (question.length < 10 || question.length > 200) {
    return NextResponse.json({ error: "Question must be 10-200 characters" }, { status: 400 });
  }
  if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Close date must be in the future" }, { status: 400 });
  }

  // Categorical markets need 2-10 distinct, non-empty outcome labels.
  let labels: string[] = [];
  if (kind === "CATEGORICAL") {
    labels = Array.isArray(body?.outcomes)
      ? body.outcomes.map((o: unknown) => (typeof o === "string" ? o.trim() : "")).filter(Boolean)
      : [];
    if (labels.length < 2 || labels.length > 10) {
      return NextResponse.json(
        { error: "Categorical markets need between 2 and 10 outcomes" },
        { status: 400 }
      );
    }
    if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) {
      return NextResponse.json({ error: "Outcome labels must be unique" }, { status: 400 });
    }
    if (labels.some((l) => l.length > 60)) {
      return NextResponse.json({ error: "Outcome labels must be under 60 characters" }, { status: 400 });
    }
  }

  const market = await prisma.market.create({
    data: {
      question,
      description,
      closesAt,
      kind,
      category,
      creatorId: user.id,
      outcomes:
        kind === "CATEGORICAL"
          ? { create: labels.map((label, i) => ({ label, sortOrder: i })) }
          : undefined,
    },
  });
  return NextResponse.json(market, { status: 201 });
}
