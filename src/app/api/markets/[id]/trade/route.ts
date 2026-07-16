import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buy, sell, type Outcome } from "@/lib/lmsr";
import { getSessionUserId } from "@/lib/session";

/**
 * Execute a trade against the market maker.
 * Buy:  { outcome: "YES"|"NO", spend: number }   — spend currency, receive shares
 * Sell: { outcome: "YES"|"NO", sellShares: number } — return shares, receive currency
 *
 * All state (market quantities, balance, position, trade row) changes in one
 * transaction, re-reading the market inside it so concurrent trades can't
 * execute against a stale price.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const outcome = body?.outcome as Outcome;
  if (outcome !== "YES" && outcome !== "NO") {
    return NextResponse.json({ error: "outcome must be YES or NO" }, { status: 400 });
  }

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
      const market = await tx.market.findUnique({ where: { id } });
      if (!market) throw new ApiError(404, "Market not found");
      if (market.resolution) throw new ApiError(400, "Market is resolved");
      if (market.closesAt.getTime() <= Date.now()) throw new ApiError(400, "Market is closed");

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const state = { qYes: market.qYes, qNo: market.qNo, b: market.liquidityB };

      let trade;
      if (isBuy) {
        if (spend > user.balance) throw new ApiError(400, "Insufficient balance");
        trade = buy(state, outcome, spend);
      } else {
        const position = await tx.position.findUnique({
          where: { userId_marketId_outcome: { userId, marketId: id, outcome } },
        });
        if (!position || position.shares < sellShares - 1e-9) {
          throw new ApiError(400, "Not enough shares to sell");
        }
        trade = sell(state, outcome, Math.min(sellShares, position.shares));
      }

      await tx.market.update({
        where: { id },
        data: { qYes: trade.newState.qYes, qNo: trade.newState.qNo },
      });
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: trade.cost } },
      });
      await tx.position.upsert({
        where: { userId_marketId_outcome: { userId, marketId: id, outcome } },
        create: { userId, marketId: id, outcome, shares: trade.shares },
        update: { shares: { increment: trade.shares } },
      });
      const row = await tx.trade.create({
        data: {
          marketId: id,
          userId,
          outcome,
          shares: trade.shares,
          cost: trade.cost,
          probAfter: trade.probAfter,
        },
      });

      return { trade: row, probAfter: trade.probAfter, balance: user.balance - trade.cost };
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
