import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney, formatPercent, formatShares } from "@/lib/format";
import { probYes } from "@/lib/lmsr";
import { pricedOutcomes } from "@/lib/market";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const START_BALANCE = 1000;

interface Row {
  marketId: string;
  question: string;
  resolved: boolean;
  cost: number; // net currency put in (buys − sell proceeds)
  value: number; // open: mark-to-market; resolved: payout
  holdingsText: string; // e.g. "12.3 YES" or "5 Alice · 2 Bob"
  headline: string; // resolution label or leading price
}

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Every trade the user made, with its market and (for categorical) outcomes.
  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
    include: { market: { include: { outcomes: true } } },
  });

  // Group by market: cost basis, and net shares per outcome key from the ledger.
  // (Positions only change via trades, so ledger sums equal shares held — even
  // for resolved markets, whose Position rows have been zeroed on payout.)
  type Group = {
    market: (typeof trades)[number]["market"];
    cost: number;
    shares: Map<string, number>;
  };
  const groups = new Map<string, Group>();
  for (const t of trades) {
    let g = groups.get(t.marketId);
    if (!g) {
      g = { market: t.market, cost: 0, shares: new Map() };
      groups.set(t.marketId, g);
    }
    g.cost += t.cost;
    g.shares.set(t.outcome, (g.shares.get(t.outcome) ?? 0) + t.shares);
  }

  const rows: Row[] = [];
  for (const { market, cost, shares } of groups.values()) {
    const isCat = market.kind === "CATEGORICAL";
    const labelOf = (key: string) =>
      isCat ? (market.outcomes.find((o) => o.id === key)?.label ?? key) : key;

    // Price of each outcome key, for mark-to-market and the headline.
    const priceOf = new Map<string, number>();
    if (isCat) {
      for (const o of pricedOutcomes(market.outcomes, market.liquidityB)) priceOf.set(o.id, o.price);
    } else {
      const p = probYes({ qYes: market.qYes, qNo: market.qNo, b: market.liquidityB });
      priceOf.set("YES", p);
      priceOf.set("NO", 1 - p);
    }

    let value = 0;
    if (market.resolution) {
      value = shares.get(market.resolution) ?? 0; // winning shares pay ₱1 each
    } else {
      for (const [key, s] of shares) value += s * (priceOf.get(key) ?? 0);
    }

    const holdingsText =
      [...shares.entries()]
        .filter(([, s]) => s > 1e-9)
        .map(([key, s]) => `${formatShares(s)} ${labelOf(key)}`)
        .join(" · ") || "—";

    const headline = market.resolution
      ? `resolved “${labelOf(market.resolution)}”`
      : isCat
        ? "open"
        : formatPercent(priceOf.get("YES") ?? 0);

    rows.push({
      marketId: market.id,
      question: market.question,
      resolved: !!market.resolution,
      cost,
      value,
      holdingsText,
      headline,
    });
  }

  const open = rows.filter((r) => !r.resolved);
  const resolved = rows.filter((r) => r.resolved);
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
                      <span className="ml-2 font-mono text-xs text-zinc-500">{r.headline}</span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {r.holdingsText}
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
