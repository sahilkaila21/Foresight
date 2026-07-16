import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { probYes } from "@/lib/lmsr";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const markets = await prisma.market.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { username: true } },
      _count: { select: { trades: true } },
    },
  });

  return NextResponse.json(
    markets.map((m) => ({
      id: m.id,
      question: m.question,
      description: m.description,
      closesAt: m.closesAt,
      resolution: m.resolution,
      resolvedAt: m.resolvedAt,
      creator: m.creator.username,
      createdAt: m.createdAt,
      tradeCount: m._count.trades,
      probYes: probYes({ qYes: m.qYes, qNo: m.qNo, b: m.liquidityB }),
    }))
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const closesAt = new Date(body?.closesAt ?? NaN);

  if (question.length < 10 || question.length > 200) {
    return NextResponse.json({ error: "Question must be 10-200 characters" }, { status: 400 });
  }
  if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Close date must be in the future" }, { status: 400 });
  }

  const market = await prisma.market.create({
    data: { question, description, closesAt, creatorId: user.id },
  });
  return NextResponse.json(market, { status: 201 });
}
