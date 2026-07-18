import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Admin: remove a candidate outcome from a categorical market.
 *
 * Same guard as adding — only before trading starts. A market must keep at
 * least two outcomes.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; outcomeId: string }> }
) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!admin.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id, outcomeId } = await params;
  const market = await prisma.market.findUnique({
    where: { id },
    include: { outcomes: true, _count: { select: { trades: true } } },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
  if (market.resolution)
    return NextResponse.json({ error: "Market is already resolved" }, { status: 400 });
  if (market._count.trades > 0)
    return NextResponse.json(
      { error: "Can't change players once trading has started" },
      { status: 400 }
    );
  if (!market.outcomes.some((o) => o.id === outcomeId))
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (market.outcomes.length <= 2)
    return NextResponse.json({ error: "A market needs at least 2 players" }, { status: 400 });

  await prisma.outcome.delete({ where: { id: outcomeId } });
  return NextResponse.json({ ok: true });
}
