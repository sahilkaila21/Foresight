import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidOutcomeKey, payoutWinners } from "@/lib/resolution";
import { getCurrentUser } from "@/lib/session";

/**
 * Admin adjudication (stands in for a decentralized oracle committee).
 * Resolves any unresolved market to `outcome`, settling bonds:
 *   - disputed: the side that matched the final outcome keeps its bond and wins
 *     the other side's bond; the wrong side is slashed.
 *   - undisputed proposal: the proposer's bond is refunded.
 * Then pays out the winning shares.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!admin.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  try {
    await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({ where: { id }, include: { outcomes: true } });
      if (!market) throw new ApiError(404, "Market not found");
      if (market.resolution) throw new ApiError(400, "Market is already resolved");
      if (!isValidOutcomeKey(market, body?.outcome)) throw new ApiError(400, "Invalid outcome");
      const outcome = body.outcome;

      const credit = async (userId: string, amount: number) => {
        if (amount > 0) {
          await tx.user.update({ where: { id: userId }, data: { balance: { increment: amount } } });
        }
      };

      if (market.disputed && market.proposedById && market.disputedById) {
        const proposerRight = outcome === market.proposedOutcome;
        if (proposerRight) {
          // Proposer keeps their bond and takes the disputer's.
          await credit(market.proposedById, market.proposerBond + market.disputerBond);
        } else {
          // Disputer keeps their bond and takes the proposer's.
          await credit(market.disputedById, market.disputerBond + market.proposerBond);
        }
      } else if (market.proposedOutcome && market.proposedById) {
        // Undisputed proposal resolved by admin: refund the bond.
        await credit(market.proposedById, market.proposerBond);
      }

      await payoutWinners(tx, id, outcome);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
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
