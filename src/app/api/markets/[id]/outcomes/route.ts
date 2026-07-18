import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Admin: add a candidate outcome (e.g. a player) to a categorical market.
 *
 * Only allowed before any trading has happened — adding/removing outcomes
 * reshuffles every price and would strand existing positions, so the candidate
 * list is locked once the first trade lands.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!admin.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "Player name is required" }, { status: 400 });
  if (label.length > 40) return NextResponse.json({ error: "Name is too long" }, { status: 400 });

  const market = await prisma.market.findUnique({
    where: { id },
    include: { outcomes: true, _count: { select: { trades: true } } },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
  if (market.kind !== "CATEGORICAL")
    return NextResponse.json({ error: "Only categorical markets have players" }, { status: 400 });
  if (market.resolution)
    return NextResponse.json({ error: "Market is already resolved" }, { status: 400 });
  if (market._count.trades > 0)
    return NextResponse.json(
      { error: "Can't change players once trading has started" },
      { status: 400 }
    );
  if (market.outcomes.some((o) => o.label.toLowerCase() === label.toLowerCase()))
    return NextResponse.json({ error: "That player is already listed" }, { status: 400 });

  const maxSort = market.outcomes.reduce((m, o) => Math.max(m, o.sortOrder), -1);
  await prisma.outcome.create({ data: { marketId: id, label, sortOrder: maxSort + 1, q: 0 } });
  return NextResponse.json({ ok: true });
}
