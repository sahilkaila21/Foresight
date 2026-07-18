import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Admin: set a categorical market's opening odds.
 *
 * LMSR price of outcome i is softmax(q_i / b), so to open at target
 * probabilities p_i we set q_i = b · ln(p_i) (softmax is shift-invariant, so
 * the constant doesn't matter). Only allowed before trading starts — the same
 * lock as editing players — and the history chart reconstructs this opening
 * baseline so it stays consistent with the live price.
 *
 * Body: { odds: { [outcomeId]: percent } } — percents must be positive and
 * total ~100.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!admin.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const odds = body?.odds;
  if (!odds || typeof odds !== "object")
    return NextResponse.json({ error: "Missing odds" }, { status: 400 });

  const market = await prisma.market.findUnique({
    where: { id },
    include: { outcomes: true, _count: { select: { trades: true } } },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
  if (market.kind !== "CATEGORICAL")
    return NextResponse.json({ error: "Only categorical markets" }, { status: 400 });
  if (market.resolution)
    return NextResponse.json({ error: "Market is already resolved" }, { status: 400 });
  if (market._count.trades > 0)
    return NextResponse.json(
      { error: "Can't set opening odds once trading has started" },
      { status: 400 }
    );

  const entries = market.outcomes.map((o) => ({ id: o.id, pct: Number(odds[o.id]) }));
  if (entries.some((e) => !Number.isFinite(e.pct) || e.pct <= 0))
    return NextResponse.json({ error: "Every outcome needs a positive %" }, { status: 400 });
  const total = entries.reduce((s, e) => s + e.pct, 0);
  if (Math.abs(total - 100) > 1)
    return NextResponse.json(
      { error: `Percentages must total 100 (got ${Math.round(total)})` },
      { status: 400 }
    );

  const b = market.liquidityB;
  // Normalize to exact fractions, then map to q via q = b · ln(p).
  await prisma.$transaction(
    entries.map((e) =>
      prisma.outcome.update({
        where: { id: e.id },
        data: { q: b * Math.log(e.pct / total) },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
