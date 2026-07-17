import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RESOLUTION_BOND } from "@/lib/resolution";
import { getSessionUserId } from "@/lib/session";

/**
 * Dispute the proposed outcome during the challenge window, staking a bond.
 * Escalates the market to admin adjudication.
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
      if (market.disputed) throw new ApiError(400, "Proposal is already disputed");
      if (market.proposedById === userId) throw new ApiError(400, "You cannot dispute your own proposal");
      if (market.challengeUntil && market.challengeUntil.getTime() <= Date.now()) {
        throw new ApiError(400, "The challenge window has closed");
      }

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.balance < RESOLUTION_BOND) {
        throw new ApiError(400, `Disputing requires a ₱${RESOLUTION_BOND} bond`);
      }

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: RESOLUTION_BOND } },
      });
      await tx.market.update({
        where: { id },
        data: { disputed: true, disputedById: userId, disputerBond: RESOLUTION_BOND },
      });
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
