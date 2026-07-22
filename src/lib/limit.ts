import type { Prisma } from "@prisma/client";
import { formatMoney, formatPercent } from "./format";
import { buy, probYes, sell, type Outcome } from "./lmsr";
import { notify } from "./notify";

/**
 * Resting limit orders for BINARY markets. A BUY fills when its outcome's price
 * drops to/below the limit (get in cheap); a SELL fills when the price rises
 * to/above it (take profit). Orders are filled opportunistically here — called
 * inside the trade transaction after every trade, since a trade is what moves
 * the price. Categorical markets don't support limit orders yet.
 *
 * Must run inside a transaction. Reads the market fresh so it sees the price the
 * just-executed trade left behind, then walks the open orders, re-checking the
 * price after each fill (a fill moves it further).
 */
export async function fillLimitOrders(
  tx: Prisma.TransactionClient,
  marketId: string
): Promise<void> {
  const market = await tx.market.findUnique({
    where: { id: marketId },
    select: {
      id: true,
      kind: true,
      question: true,
      qYes: true,
      qNo: true,
      liquidityB: true,
      resolution: true,
      closesAt: true,
    },
  });
  if (!market || market.kind === "CATEGORICAL") return;
  if (market.resolution || market.closesAt.getTime() <= Date.now()) return;

  const orders = await tx.limitOrder.findMany({
    where: { marketId, status: "OPEN" },
    orderBy: { createdAt: "asc" },
  });
  if (orders.length === 0) return;

  const state = { qYes: market.qYes, qNo: market.qNo, b: market.liquidityB };
  const href = `/markets/${marketId}`;
  let changed = true;
  let guard = 0;

  // Re-pass until a whole pass fills nothing (a fill can make another eligible).
  while (changed && guard++ < 100) {
    changed = false;
    for (const order of orders) {
      if (order.status !== "OPEN") continue;
      const outcome = order.outcome as Outcome;
      if (outcome !== "YES" && outcome !== "NO") continue;

      const price = outcome === "YES" ? probYes(state) : 1 - probYes(state);
      const eligible =
        order.side === "BUY" ? price <= order.limitProb + 1e-9 : price >= order.limitProb - 1e-9;
      if (!eligible) continue;

      if (order.side === "BUY") {
        const user = await tx.user.findUniqueOrThrow({ where: { id: order.userId } });
        if (order.spend > user.balance + 1e-9) {
          // Can't afford it any more — retire the order.
          await tx.limitOrder.update({
            where: { id: order.id },
            data: { status: "CANCELLED" },
          });
          order.status = "CANCELLED";
          await notify(
            tx,
            order.userId,
            "LIMIT_FILLED",
            `Limit buy on "${market.question}" cancelled — insufficient balance`,
            href
          );
          continue;
        }
        const tr = buy(state, outcome, order.spend);
        state.qYes = tr.newState.qYes;
        state.qNo = tr.newState.qNo;
        await applyFill(tx, {
          marketId,
          userId: order.userId,
          outcome,
          shares: tr.shares,
          cost: tr.cost,
          probAfter: tr.probAfter,
        });
        await tx.limitOrder.update({
          where: { id: order.id },
          data: { status: "FILLED", filledAt: new Date() },
        });
        order.status = "FILLED";
        await notify(
          tx,
          order.userId,
          "LIMIT_FILLED",
          `Limit buy filled: ${outcome} on "${market.question}" at ${formatPercent(price)}`,
          href
        );
        changed = true;
      } else {
        // SELL: sell up to the held amount.
        const position = await tx.position.findUnique({
          where: {
            userId_marketId_outcome: { userId: order.userId, marketId, outcome },
          },
        });
        const held = position?.shares ?? 0;
        const toSell = Math.min(order.shares, held);
        if (toSell <= 1e-9) {
          await tx.limitOrder.update({
            where: { id: order.id },
            data: { status: "CANCELLED" },
          });
          order.status = "CANCELLED";
          await notify(
            tx,
            order.userId,
            "LIMIT_FILLED",
            `Limit sell on "${market.question}" cancelled — no shares held`,
            href
          );
          continue;
        }
        const tr = sell(state, outcome, toSell);
        state.qYes = tr.newState.qYes;
        state.qNo = tr.newState.qNo;
        await applyFill(tx, {
          marketId,
          userId: order.userId,
          outcome,
          shares: tr.shares, // negative
          cost: tr.cost, // negative (user receives)
          probAfter: tr.probAfter,
        });
        await tx.limitOrder.update({
          where: { id: order.id },
          data: { status: "FILLED", filledAt: new Date() },
        });
        order.status = "FILLED";
        await notify(
          tx,
          order.userId,
          "LIMIT_FILLED",
          `Limit sell filled: ${formatMoney(-tr.cost)} of ${outcome} on "${market.question}"`,
          href
        );
        changed = true;
      }
    }
  }

  // Persist the final market state after all fills.
  await tx.market.update({
    where: { id: marketId },
    data: { qYes: state.qYes, qNo: state.qNo },
  });
}

/** Shared side effects of a fill: balance, position, trade row, volume. */
async function applyFill(
  tx: Prisma.TransactionClient,
  f: { marketId: string; userId: string; outcome: string; shares: number; cost: number; probAfter: number }
): Promise<void> {
  await tx.user.update({
    where: { id: f.userId },
    data: { balance: { decrement: f.cost } },
  });
  await tx.position.upsert({
    where: {
      userId_marketId_outcome: { userId: f.userId, marketId: f.marketId, outcome: f.outcome },
    },
    create: { userId: f.userId, marketId: f.marketId, outcome: f.outcome, shares: f.shares },
    update: { shares: { increment: f.shares } },
  });
  await tx.trade.create({
    data: {
      marketId: f.marketId,
      userId: f.userId,
      outcome: f.outcome,
      shares: f.shares,
      cost: f.cost,
      probAfter: f.probAfter,
    },
  });
  await tx.market.update({
    where: { id: f.marketId },
    data: { volume: { increment: Math.abs(f.cost) } },
  });
}
