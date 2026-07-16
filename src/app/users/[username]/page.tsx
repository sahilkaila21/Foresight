import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, formatPercent, formatShares } from "@/lib/format";
import { marketHeadline } from "@/lib/market";
import { openPositionsValue, positionValue, START_BALANCE } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username: decodeURIComponent(username) },
    include: {
      markets: {
        orderBy: { createdAt: "desc" },
        include: { outcomes: true, _count: { select: { trades: true } } },
      },
      positions: {
        where: { shares: { gt: 1e-9 } },
        include: { market: { include: { outcomes: true } } },
      },
      trades: {
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { market: { include: { outcomes: true } } },
      },
      _count: { select: { trades: true } },
    },
  });
  if (!user) notFound();

  const positionsValue = openPositionsValue(user.positions);
  const netWorth = user.balance + positionsValue;
  const profit = netWorth - START_BALANCE;

  const labelOf = (market: { kind: string; outcomes: { id: string; label: string }[] }, key: string) =>
    market.kind === "CATEGORICAL"
      ? (market.outcomes.find((o) => o.id === key)?.label ?? key)
      : key;

  const stats: [string, string, string][] = [
    ["Net worth", formatMoney(netWorth), ""],
    [
      "Profit",
      `${profit >= 0 ? "+" : ""}${formatMoney(profit)}`,
      profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
    ],
    ["Markets created", String(user.markets.length), ""],
    ["Trades", String(user._count.trades), ""],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">@{user.username}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Member since {formatDate(user.createdAt)} ·{" "}
          <Link href="/leaderboard" className="underline">
            leaderboard
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value, cls]) => (
          <div key={label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className={`mt-1 font-mono text-lg font-bold ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Open positions</h2>
        {user.positions.length === 0 ? (
          <p className="text-sm text-zinc-500">No open positions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-4 font-medium">Market</th>
                  <th className="py-2 pr-4 font-medium">Holding</th>
                  <th className="py-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {user.positions.map((pos) => (
                  <tr key={pos.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="max-w-xs py-2 pr-4">
                      <Link href={`/markets/${pos.marketId}`} className="hover:underline">
                        {pos.market.question}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {formatShares(pos.shares)} {labelOf(pos.market, pos.outcome)}
                    </td>
                    <td className="py-2 text-right font-mono">{formatMoney(positionValue(pos))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Markets created</h2>
        {user.markets.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {user.markets.map((m) => {
              const headline = marketHeadline(m);
              const resolvedLabel = m.resolution ? labelOf(m, m.resolution) : null;
              return (
                <li key={m.id}>
                  <Link
                    href={`/markets/${m.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-3 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  >
                    <span className="min-w-0 truncate text-sm">{m.question}</span>
                    <span className="shrink-0 font-mono text-xs text-zinc-500">
                      {resolvedLabel ? `resolved ${resolvedLabel}` : formatPercent(headline.prob)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Recent trades</h2>
        {user.trades.length === 0 ? (
          <p className="text-sm text-zinc-500">No trades yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {user.trades.map((t) => {
              const color =
                t.outcome === "YES"
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : t.outcome === "NO"
                    ? "font-semibold text-rose-600 dark:text-rose-400"
                    : "font-semibold text-indigo-600 dark:text-indigo-400";
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between border-b border-zinc-100 py-2 dark:border-zinc-900"
                >
                  <span className="min-w-0 pr-4">
                    {t.shares >= 0 ? "bought" : "sold"} {formatShares(Math.abs(t.shares))}{" "}
                    <span className={color}>{labelOf(t.market, t.outcome)}</span> in{" "}
                    <Link href={`/markets/${t.marketId}`} className="hover:underline">
                      {t.market.question}
                    </Link>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-zinc-500">
                    {formatMoney(Math.abs(t.cost))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
