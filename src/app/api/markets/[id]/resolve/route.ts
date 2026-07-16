import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

/**
 * Resolve a market to a winning outcome (creator only, v1 trust model).
 * Binary:      { outcome: "YES"|"NO" }
 * Categorical: { outcomeId }
 * Every share of the winning outcome pays 1 currency unit; positions are zeroed.
 * The stored resolution is "YES"/"NO" for binary and the Outcome id for categorical.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  try {
    const resolution = await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({ where: { id }, include: { outcomes: true } });
      if (!market) throw new ApiError(404, "Market not found");
      if (market.creatorId !== userId) {
        throw new ApiError(403, "Only the market creator can resolve");
      }
      if (market.resolution) throw new ApiError(400, "Market is already resolved");

      let winningKey: string;
      if (market.kind === "CATEGORICAL") {
        const outcomeId = typeof body?.outcomeId === "string" ? body.outcomeId : "";
        if (!market.outcomes.some((o) => o.id === outcomeId)) {
          throw new ApiError(400, "Unknown outcome");
        }
        winningKey = outcomeId;
      } else {
        if (body?.outcome !== "YES" && body?.outcome !== "NO") {
          throw new ApiError(400, "outcome must be YES or NO");
        }
        winningKey = body.outcome;
      }

      const winners = await tx.position.findMany({
        where: { marketId: id, outcome: winningKey, shares: { gt: 0 } },
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
        data: { resolution: winningKey, resolvedAt: new Date() },
      });
      return winningKey;
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
