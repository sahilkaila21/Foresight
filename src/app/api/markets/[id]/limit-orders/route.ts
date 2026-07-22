import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

/**
 * Place a resting limit order on a binary market.
 * Body: { outcome: "YES"|"NO", side: "BUY"|"SELL", limitProb, spend?, shares? }
 *   BUY  — fills when the outcome's price <= limitProb, spending `spend`.
 *   SELL — fills when the outcome's price >= limitProb, selling `shares`.
 * Nothing is reserved up front; the order is checked and may fill (or be
 * cancelled for insufficient balance/shares) whenever a trade moves the price.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const outcome = body?.outcome;
  const side = body?.side;
  const limitProb = Number(body?.limitProb);
  const spend = Number(body?.spend);
  const shares = Number(body?.shares);

  if (outcome !== "YES" && outcome !== "NO") {
    return NextResponse.json({ error: "outcome must be YES or NO" }, { status: 400 });
  }
  if (side !== "BUY" && side !== "SELL") {
    return NextResponse.json({ error: "side must be BUY or SELL" }, { status: 400 });
  }
  if (!Number.isFinite(limitProb) || limitProb <= 0 || limitProb >= 1) {
    return NextResponse.json({ error: "limitProb must be between 0 and 1" }, { status: 400 });
  }
  if (side === "BUY" && !(Number.isFinite(spend) && spend > 0)) {
    return NextResponse.json({ error: "spend must be positive for a buy" }, { status: 400 });
  }
  if (side === "SELL" && !(Number.isFinite(shares) && shares > 0)) {
    return NextResponse.json({ error: "shares must be positive for a sell" }, { status: 400 });
  }

  const market = await prisma.market.findUnique({
    where: { id },
    select: { id: true, kind: true, resolution: true, closesAt: true },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
  if (market.kind === "CATEGORICAL") {
    return NextResponse.json({ error: "Limit orders are only supported on binary markets" }, { status: 400 });
  }
  if (market.resolution || market.closesAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Market is closed" }, { status: 400 });
  }

  const order = await prisma.limitOrder.create({
    data: {
      userId,
      marketId: id,
      outcome,
      side,
      limitProb,
      spend: side === "BUY" ? spend : 0,
      shares: side === "SELL" ? shares : 0,
    },
  });
  return NextResponse.json({ ok: true, id: order.id }, { status: 201 });
}

/** The caller's own orders on this market. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ items: [] });
  const { id } = await params;
  const items = await prisma.limitOrder.findMany({
    where: { marketId: id, userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}
