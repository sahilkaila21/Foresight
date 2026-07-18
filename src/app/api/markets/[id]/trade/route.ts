import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buy, buyN, sell, sellN, type Outcome } from "@/lib/lmsr";
import { getSessionUserId } from "@/lib/session";

/**
 * Execute a trade against the market maker.
 *
 * Binary:      { outcome: "YES"|"NO", spend }  or  { outcome, sellShares }
 * Categorical: { outcomeId, spend }            or  { outcomeId, sellShares }
 *
 * All state (share quantities, balance, position, trade row) changes in one
 * transaction, re-reading the market inside it so concurrent trades can't
 * execute against a stale price. Position/Trade `outcome` holds "YES"/"NO"
 * for binary markets and the Outcome id for categorical ones.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const spend = Number(body?.spend);
  const sellShares = Number(body?.sellShares);
  const isBuy = Number.isFinite(spend) && spend > 0;
  const isSell = Number.isFinite(sellShares) && sellShares > 0;
  if (isBuy === isSell) {
    return NextResponse.json(
      { error: "Provide either a positive spend (buy) or sellShares (sell)" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({
        where: { id },
        include: { outcomes: true },
      });
      if (!market) throw new ApiError(404, "Market not found");
      if (market.resolution) throw new ApiError(400, "Market is resolved");
      if (market.closesAt.getTime() <= Date.now()) throw new ApiError(400, "Market is closed");

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      // The key stored in Position/Trade.outcome, plus the trade math result.
      let key: string;
      let shares: number;
      let cost: number;
      let probAfter: number;

      const heldShares = async (outcome: string) => {
        const position = await tx.position.findUnique({
          where: { userId_marketId_outcome: { userId, marketId: id, outcome } },
        });
        return position?.shares ?? 0;
      };

      if (market.kind === "CATEGORICAL") {
        const outcomeId = typeof body?.outcomeId === "string" ? body.outcomeId : "";
        const sorted = [...market.outcomes].sort((a, z) => a.sortOrder - z.sortOrder);
        const idx = sorted.findIndex((o) => o.id === outcomeId);
        if (idx < 0) throw new ApiError(400, "Unknown outcome");
        key = outcomeId;
        const q = sorted.map((o) => o.q);

        let tr;
        if (isBuy) {
          if (spend > user.balance + 1e-9) throw new ApiError(400, "Insufficient balance");
          tr = buyN(q, market.liquidityB, idx, spend);
        } else {
          const held = await heldShares(outcomeId);
          if (held < sellShares - 1e-9) throw new ApiError(400, "Not enough shares to sell");
          tr = sellN(q, market.liquidityB, idx, Math.min(sellShares, held));
        }
        shares = tr.shares;
        cost = tr.cost;
        probAfter = tr.pricesAfter[idx];
        await tx.outcome.update({ where: { id: outcomeId }, data: { q: tr.newQ[idx] } });
      } else {
        const outcome = body?.outcome as Outcome;
        if (outcome !== "YES" && outcome !== "NO") {
          throw new ApiError(400, "outcome must be YES or NO");
        }
        key = outcome;
        const state = { qYes: market.qYes, qNo: market.qNo, b: market.liquidityB };

        let tr;
        if (isBuy) {
          if (spend > user.balance + 1e-9) throw new ApiError(400, "Insufficient balance");
          tr = buy(state, outcome, spend);
        } else {
          const held = await heldShares(outcome);
          if (held < sellShares - 1e-9) throw new ApiError(400, "Not enough shares to sell");
          tr = sell(state, outcome, Math.min(sellShares, held));
        }
        shares = tr.shares;
        cost = tr.cost;
        probAfter = tr.probAfter;
        await tx.market.update({
          where: { id },
          data: { qYes: tr.newState.qYes, qNo: tr.newState.qNo },
        });
      }

      await tx.market.update({
        where: { id },
        data: { volume: { increment: Math.abs(cost) } },
      });
      // Placing a bet also clears the post-reset "please re-bet" notice.
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: cost }, showResetNotice: false },
      });
      await tx.position.upsert({
        where: { userId_marketId_outcome: { userId, marketId: id, outcome: key } },
        create: { userId, marketId: id, outcome: key, shares },
        update: { shares: { increment: shares } },
      });
      const row = await tx.trade.create({
        data: { marketId: id, userId, outcome: key, shares, cost, probAfter },
      });

      return { trade: row, probAfter, balance: user.balance - cost };
    });

    return NextResponse.json(result);
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
