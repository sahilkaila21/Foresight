import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney, formatPercent, formatShares } from "@/lib/format";
import { probYes } from "@/lib/lmsr";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const START_BALANCE = 1000;

interface Row {
  marketId: string;
  question: string;
  resolution: string | null;
  probYes: number;
  yesShares: number;
  noShares: number;
  cost: number; // net currency put in via trades (buys − sell proceeds)
  value: number; // open: mark-to-market; resolved: payout received
}

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
    include: { market: true },
  });
  const positions = await prisma.position.findMany({
    where: { userId: user.id },
  });
  const held = new Map(positions.map((p) => [`${p.marketId}:${p.outcome}`, p.shares]));

  // One row per market. Ledger sums give cost basis; for resolved markets the
  // summed shares equal shares held at resolution (positions only change via trades).
  const rows = new Map<string, Row>();
  for (const t of trades) {
    let row = rows.get(t.marketId);
    if (!row) {
      const m = t.market;
      row = {
        marketId: m.id,
        question: m.question,
        resolution: m.resolution,
        probYes: probYes({ qYes: m.qYes, qNo: m.qNo, b: m.liquidityB }),
        yesShares: 0,
        noShares: 0,
        cost: 0,
        value: 0,
      };
      rows.set(t.marketId, row);
    }
    row.cost += t.cost;
    if (t.outcome === "YES") row.yesShares += t.shares;
    else row.noShares += t.shares;
  }

  for (const row of rows.values()) {
    if (row.resolution) {
      row.value = row.resolution === "YES" ? row.yesShares : row.noShares;
    } else {
      row.yesShares = held.get(`${row.marketId}:YES`) ?? 0;
      row.noShares = held.get(`${row.marketId}:NO`) ?? 0;
      row.value = row.yesShares * row.probYes + row.noShares * (1 - row.probYes);
    }
  }

  const open = [...rows.values()].filter((r) => !r.resolution);
  const resolved = [...rows.values()].filter((r) => r.resolution);
  const portfolioValue = open.reduce((s, r) => s + r.value, 0);
  const netWorth = user.balance + portfolioValue;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Portfolio</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Balance", formatMoney(user.balance), ""],
          ["Positions", formatMoney(portfolioValue), ""],
          ["Net worth", formatMoney(netWorth), ""],
          [
            "Lifetime P/L",
            `${netWorth >= START_BALANCE ? "+" : ""}${formatMoney(netWorth - START_BALANCE)}`,
            netWorth >= START_BALANCE
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400",
          ],
        ].map(([label, value, cls]) => (
          <div key={label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className={`mt-1 font-mono text-lg font-bold ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      <Section
        title="Open positions"
        rows={open}
        empty="No open positions. Find a market you disagree with."
        valueLabel="Value"
      />
      <Section
        title="Resolved markets"
        rows={resolved}
        empty="Nothing resolved yet."
        valueLabel="Payout"
      />
    </div>
  );
}

function Section({
  title,
  rows,
  empty,
  valueLabel,
}: {
  title: string;
  rows: Row[];
  empty: string;
  valueLabel: string;
}) {
  return (
    <div>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium">Market</th>
                <th className="py-2 pr-4 font-medium">Shares</th>
                <th className="py-2 pr-4 text-right font-medium">Cost</th>
                <th className="py-2 pr-4 text-right font-medium">{valueLabel}</th>
                <th className="py-2 text-right font-medium">P/L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pnl = r.value - r.cost;
                return (
                  <tr key={r.marketId} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="max-w-xs py-2 pr-4">
                      <Link href={`/markets/${r.marketId}`} className="hover:underline">
                        {r.question}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-zinc-500">
                        {r.resolution ?? formatPercent(r.probYes)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {r.yesShares > 1e-9 && `${formatShares(r.yesShares)} YES`}
                      {r.yesShares > 1e-9 && r.noShares > 1e-9 && " · "}
                      {r.noShares > 1e-9 && `${formatShares(r.noShares)} NO`}
                      {r.yesShares <= 1e-9 && r.noShares <= 1e-9 && "—"}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{formatMoney(r.cost)}</td>
                    <td className="py-2 pr-4 text-right font-mono">{formatMoney(r.value)}</td>
                    <td
                      className={`py-2 text-right font-mono font-semibold ${
                        pnl >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {formatMoney(pnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
