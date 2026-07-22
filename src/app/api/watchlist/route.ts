import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

/** Toggle a market in the caller's watchlist. Body: { marketId }. */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const marketId = typeof body?.marketId === "string" ? body.marketId : "";
  if (!marketId) return NextResponse.json({ error: "marketId required" }, { status: 400 });

  const existing = await prisma.watchlist.findUnique({
    where: { userId_marketId: { userId, marketId } },
  });

  if (existing) {
    await prisma.watchlist.delete({ where: { id: existing.id } });
    return NextResponse.json({ watching: false });
  }

  const market = await prisma.market.findUnique({ where: { id: marketId }, select: { id: true } });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

  await prisma.watchlist.create({ data: { userId, marketId } });
  return NextResponse.json({ watching: true });
}
