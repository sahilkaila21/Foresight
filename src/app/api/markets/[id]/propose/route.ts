import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  CHALLENGE_WINDOW_MS,
  isValidOutcomeKey,
  RESOLUTION_BOND,
} from "@/lib/resolution";
import { getSessionUserId } from "@/lib/session";

/**
 * Propose a winning outcome for a closed market, staking a bond. Opens the
 * challenge window. Body: { outcome } — "YES"/"NO" or an Outcome id.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  try {
    await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({ where: { id }, include: { outcomes: true } });
      if (!market) throw new ApiError(404, "Market not found");
      if (market.resolution) throw new ApiError(400, "Market is already resolved");
      if (market.proposedOutcome) throw new ApiError(400, "An outcome has already been proposed");
      if (market.closesAt.getTime() > Date.now()) {
        throw new ApiError(400, "Market is still open for trading");
      }
      if (!isValidOutcomeKey(market, body?.outcome)) {
        throw new ApiError(400, "Invalid outcome");
      }

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.balance < RESOLUTION_BOND) {
        throw new ApiError(400, `Proposing requires a ₱${RESOLUTION_BOND} bond`);
      }

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: RESOLUTION_BOND } },
      });
      await tx.market.update({
        where: { id },
        data: {
          proposedOutcome: body.outcome,
          proposedById: userId,
          proposedAt: new Date(),
          challengeUntil: new Date(Date.now() + CHALLENGE_WINDOW_MS),
          proposerBond: RESOLUTION_BOND,
        },
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
