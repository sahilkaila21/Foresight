import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { payoutWinners } from "@/lib/resolution";
import { getSessionUserId } from "@/lib/session";

/**
 * Finalize an unchallenged proposal after its window elapses: refund the
 * proposer's bond and pay out the proposed outcome. Callable by anyone
 * (settlement is permissionless, like calling a contract's settle).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({ where: { id } });
      if (!market) throw new ApiError(404, "Market not found");
      if (market.resolution) throw new ApiError(400, "Market is already resolved");
      if (!market.proposedOutcome) throw new ApiError(400, "Nothing has been proposed yet");
      if (market.disputed) throw new ApiError(400, "Proposal is disputed; awaiting admin");
      if (!market.challengeUntil || market.challengeUntil.getTime() > Date.now()) {
        throw new ApiError(400, "The challenge window is still open");
      }

      // Undisputed proposal stands: proposer gets their bond back.
      if (market.proposedById && market.proposerBond > 0) {
        await tx.user.update({
          where: { id: market.proposedById },
          data: { balance: { increment: market.proposerBond } },
        });
      }
      await payoutWinners(tx, id, market.proposedOutcome);
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
