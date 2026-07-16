import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

/**
 * Resolve a market YES or NO (creator only, v1 trust model).
 * Every share of the winning outcome pays 1 currency unit; positions are zeroed.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const resolution = body?.outcome;
  if (resolution !== "YES" && resolution !== "NO") {
    return NextResponse.json({ error: "outcome must be YES or NO" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({ where: { id } });
      if (!market) throw new ApiError(404, "Market not found");
      if (market.creatorId !== userId) {
        throw new ApiError(403, "Only the market creator can resolve");
      }
      if (market.resolution) throw new ApiError(400, "Market is already resolved");

      const winners = await tx.position.findMany({
        where: { marketId: id, outcome: resolution, shares: { gt: 0 } },
      });
      for (const p of winners) {
        await tx.user.update({
          where: { id: p.userId },
          data: { balance: { increment: p.shares } },
        });
      }
      await tx.position.updateMany({ where: { marketId: id }, data: { shares: 0 } });
      await tx.market.update({
        where: { id },
        data: { resolution, resolvedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true, resolution });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
