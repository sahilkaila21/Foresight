import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { probYes } from "@/lib/lmsr";
import { pricedOutcomes } from "@/lib/market";
import { getSessionUserId } from "@/lib/session";

const MIN_LEGS = 2;
const MAX_LEGS = 8;
const MIN_PROB = 0.02; // guard against divide-by-tiny payouts

/**
 * Place a parlay: one stake across several legs; wins only if EVERY leg
 * resolves to its chosen outcome. Body: { stake, legs: [{ marketId, outcome }] }.
 * Entry prices are recomputed server-side; combinedProb = product of them and
 * payout = stake / combinedProb.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const stake = Number(body?.stake);
  const legsIn: { marketId: string; outcome: string }[] = Array.isArray(body?.legs) ? body.legs : [];

  if (!Number.isFinite(stake) || stake <= 0) {
    return NextResponse.json({ error: "Stake must be positive" }, { status: 400 });
  }
  if (legsIn.length < MIN_LEGS || legsIn.length > MAX_LEGS) {
    return NextResponse.json({ error: `Pick between ${MIN_LEGS} and ${MAX_LEGS} legs` }, { status: 400 });
  }
  const marketIds = legsIn.map((l) => l.marketId);
  if (new Set(marketIds).size !== marketIds.length) {
    return NextResponse.json({ error: "Each leg must be a different market" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (stake > user.balance + 1e-9) throw new ApiError(400, "Insufficient balance");

      const legData: {
        marketId: string;
        outcome: string;
        label: string;
        question: string;
        entryProb: number;
      }[] = [];
      let combinedProb = 1;

      for (const leg of legsIn) {
        const market = await tx.market.findUnique({
          where: { id: leg.marketId },
          include: { outcomes: true },
        });
        if (!market) throw new ApiError(404, "A selected market no longer exists");
        if (market.resolution || market.closesAt.getTime() <= Date.now()) {
          throw new ApiError(400, `"${market.question}" is closed`);
        }

        let entryProb: number;
        let label: string;
        if (market.kind === "CATEGORICAL") {
          const priced = pricedOutcomes(market.outcomes, market.liquidityB);
          const found = priced.find((o) => o.id === leg.outcome);
          if (!found) throw new ApiError(400, "Unknown outcome in a leg");
          entryProb = found.price;
          label = found.label;
        } else {
          if (leg.outcome !== "YES" && leg.outcome !== "NO") {
            throw new ApiError(400, "Binary legs must be YES or NO");
          }
          const p = probYes({ qYes: market.qYes, qNo: market.qNo, b: market.liquidityB });
          entryProb = leg.outcome === "YES" ? p : 1 - p;
          label = leg.outcome === "YES" ? "Yes" : "No";
        }
        if (entryProb < MIN_PROB) {
          throw new ApiError(400, `"${label}" is too unlikely to include (min ${Math.round(MIN_PROB * 100)}%)`);
        }
        combinedProb *= entryProb;
        legData.push({
          marketId: market.id,
          outcome: leg.outcome,
          label,
          question: market.question,
          entryProb,
        });
      }

      const payout = stake / combinedProb;

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: stake } },
      });
      const combo = await tx.combo.create({
        data: {
          userId,
          stake,
          combinedProb,
          payout,
          legs: { create: legData },
        },
      });
      return { id: combo.id, combinedProb, payout, balance: user.balance - stake };
    });
    return NextResponse.json(result, { status: 201 });
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
