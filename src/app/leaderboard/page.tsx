import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { probYes } from "@/lib/lmsr";
import { pricedOutcomes } from "@/lib/market";

export const dynamic = "force-dynamic";

const START_BALANCE = 1000;

export default async function LeaderboardPage() {
  const users = await prisma.user.findMany({
    include: {
      positions: {
        where: { shares: { gt: 1e-9 } },
        include: { market: { include: { outcomes: true } } },
      },
      _count: { select: { trades: true } },
    },
  });

  const ranked = users
    .map((u) => {
      // Mark open positions to market; resolved positions are already zeroed.
      const positionValue = u.positions.reduce((sum, pos) => {
        const m = pos.market;
        if (m.resolution) return sum;
        let price: number;
        if (m.kind === "CATEGORICAL") {
          const priced = pricedOutcomes(m.outcomes, m.liquidityB);
          price = priced.find((o) => o.id === pos.outcome)?.price ?? 0;
        } else {
          const p = probYes({ qYes: m.qYes, qNo: m.qNo, b: m.liquidityB });
          price = pos.outcome === "YES" ? p : 1 - p;
        }
        return sum + pos.shares * price;
      }, 0);
      const netWorth = u.balance + positionValue;
      return {
        id: u.id,
        username: u.username,
        trades: u._count.trades,
        positionValue,
        netWorth,
        profit: netWorth - START_BALANCE,
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Leaderboard</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium">#</th>
              <th className="py-2 pr-4 font-medium">Trader</th>
              <th className="py-2 pr-4 text-right font-medium">Trades</th>
              <th className="py-2 pr-4 text-right font-medium">Positions</th>
              <th className="py-2 pr-4 text-right font-medium">Net worth</th>
              <th className="py-2 text-right font-medium">Profit</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((u, i) => (
              <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-4">{["🥇", "🥈", "🥉"][i] ?? i + 1}</td>
                <td className="py-2 pr-4 font-medium">@{u.username}</td>
                <td className="py-2 pr-4 text-right text-zinc-500">{u.trades}</td>
                <td className="py-2 pr-4 text-right font-mono">{formatMoney(u.positionValue)}</td>
                <td className="py-2 pr-4 text-right font-mono font-semibold">
                  {formatMoney(u.netWorth)}
                </td>
                <td
                  className={`py-2 text-right font-mono font-semibold ${
                    u.profit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {u.profit >= 0 ? "+" : ""}
                  {formatMoney(u.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        Net worth = balance + open positions marked to current market prices. Everyone starts
        with {formatMoney(START_BALANCE)}.
      </p>
    </div>
  );
}
