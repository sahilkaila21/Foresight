import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  formatCompact,
  formatDate,
  formatMoney,
  formatPercent,
  formatShares,
  isClosed,
  nowMs,
} from "@/lib/format";
import { pricesN, probYes } from "@/lib/lmsr";
import { pricedOutcomes } from "@/lib/market";
import { getCurrentUser } from "@/lib/session";
import CategoricalResolvePanel from "@/components/CategoricalResolvePanel";
import CategoricalTradePanel from "@/components/CategoricalTradePanel";
import CommentSection from "@/components/CommentSection";
import MultiProbChart, { type Series } from "@/components/MultiProbChart";
import ProbChart from "@/components/ProbChart";
import ResolvePanel from "@/components/ResolvePanel";
import TradePanel from "@/components/TradePanel";

export const dynamic = "force-dynamic";

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      creator: { select: { username: true } },
      outcomes: true,
      trades: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { username: true } } },
      },
    },
  });
  if (!market) notFound();

  const currentUser = await getCurrentUser();
  const userId = currentUser?.id ?? null;
  const positions = userId
    ? await prisma.position.findMany({
        where: { userId, marketId: id, shares: { gt: 1e-9 } },
      })
    : [];

  const comments = await prisma.comment.findMany({
    where: { marketId: id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true } } },
  });

  const isCategorical = market.kind === "CATEGORICAL";
  const priced = isCategorical ? pricedOutcomes(market.outcomes, market.liquidityB) : [];
  // outcome key ("YES"/"NO" or Outcome id) -> human label
  const labelOf = (key: string) =>
    isCategorical ? (market.outcomes.find((o) => o.id === key)?.label ?? key) : key;

  const open = !market.resolution && !isClosed(market.closesAt);
  const yesProb = probYes({ qYes: market.qYes, qNo: market.qNo, b: market.liquidityB });

  const endT = market.resolvedAt?.getTime() ?? nowMs();

  // Binary probability history: probAfter is stored per trade, so read it directly.
  const chartPoints = [
    { t: market.createdAt.getTime(), p: 0.5 },
    ...market.trades.map((t) => ({ t: t.createdAt.getTime(), p: t.probAfter })),
    { t: endT, p: yesProb },
  ];

  // Categorical history: only the traded outcome's price is stored per trade, so
  // replay the ledger through the engine to recover every outcome's price at each step.
  let catSeries: Series[] = [];
  if (isCategorical && market.trades.length > 0) {
    const sorted = [...market.outcomes].sort((a, z) => a.sortOrder - z.sortOrder);
    const idxById = new Map(sorted.map((o, i) => [o.id, i]));
    const q = sorted.map(() => 0);
    const n = sorted.length;
    const pts = sorted.map(() => [{ t: market.createdAt.getTime(), p: 1 / n }]);
    for (const t of market.trades) {
      const idx = idxById.get(t.outcome);
      if (idx === undefined) continue;
      q[idx] += t.shares;
      const prices = pricesN(q, market.liquidityB);
      sorted.forEach((_, i) => pts[i].push({ t: t.createdAt.getTime(), p: prices[i] }));
    }
    const endPrices = pricesN(q, market.liquidityB);
    catSeries = sorted.map((o, i) => ({
      label: o.label,
      points: [...pts[i], { t: endT, p: endPrices[i] }],
    }));
  }

  const recentTrades = market.trades.slice(-30).reverse();
  const holdings = Object.fromEntries(positions.map((p) => [p.outcome, p.shares]));

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between gap-6">
          <h1 className="text-2xl font-bold">{market.question}</h1>
          {!isCategorical && (
            <div className="text-right">
              <div
                className={`font-mono text-4xl font-bold ${
                  market.resolution === "YES"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : market.resolution === "NO"
                      ? "text-rose-600 dark:text-rose-400"
                      : ""
                }`}
              >
                {market.resolution ?? formatPercent(yesProb)}
              </div>
              <div className="text-xs text-zinc-500">
                {market.resolution ? "resolved" : "chance of YES"}
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          by{" "}
          <Link href={`/users/${market.creator.username}`} className="hover:underline">
            @{market.creator.username}
          </Link>{" "}
          ·{" "}
          {market.resolution
            ? `resolved "${labelOf(market.resolution)}" on ${formatDate(market.resolvedAt!)}`
            : open
              ? `closes ${formatDate(market.closesAt)}`
              : "closed, awaiting resolution"}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
          <span>
            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
              {formatCompact(market.volume)}
            </span>{" "}
            volume
          </span>
          <span>
            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
              {formatCompact(market.liquidityB)}
            </span>{" "}
            liquidity
          </span>
          <Link href={`/?category=${market.category}`} className="hover:underline">
            {market.category}
          </Link>
        </div>
        {market.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {market.description}
          </p>
        )}
      </div>

      {isCategorical && catSeries.length > 0 && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <MultiProbChart series={catSeries} />
        </div>
      )}

      {isCategorical ? (
        <div className="space-y-2">
          {priced.map((o) => {
            const won = market.resolution === o.id;
            return (
              <div
                key={o.id}
                className={`rounded-lg border p-3 ${
                  won
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {o.label}
                    {won && " ✓"}
                  </span>
                  <span className="font-mono text-zinc-600 dark:text-zinc-400">
                    {formatPercent(o.price)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={won ? "h-full bg-emerald-500" : "h-full bg-indigo-500"}
                    style={{ width: `${Math.max(o.price * 100, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        market.trades.length > 0 && (
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <ProbChart points={chartPoints} />
          </div>
        )
      )}

      {positions.length > 0 && (
        <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h2 className="mb-2 font-semibold">Your position</h2>
          {positions.map((pos) => (
            <p key={pos.id} className="text-zinc-600 dark:text-zinc-400">
              {formatShares(pos.shares)} shares of &ldquo;{labelOf(pos.outcome)}&rdquo; — pays{" "}
              {formatMoney(pos.shares)} if it wins
            </p>
          ))}
        </div>
      )}

      {open &&
        (isCategorical ? (
          <CategoricalTradePanel
            marketId={market.id}
            outcomes={priced.map((o) => ({ id: o.id, label: o.label, q: o.q }))}
            b={market.liquidityB}
            signedIn={!!userId}
            balance={currentUser?.balance ?? 0}
            holdings={holdings}
          />
        ) : (
          <TradePanel
            marketId={market.id}
            qYes={market.qYes}
            qNo={market.qNo}
            b={market.liquidityB}
            signedIn={!!userId}
            balance={currentUser?.balance ?? 0}
            yesShares={holdings["YES"] ?? 0}
            noShares={holdings["NO"] ?? 0}
          />
        ))}

      {!market.resolution &&
        userId === market.creatorId &&
        (isCategorical ? (
          <CategoricalResolvePanel
            marketId={market.id}
            outcomes={priced.map((o) => ({ id: o.id, label: o.label }))}
          />
        ) : (
          <ResolvePanel marketId={market.id} />
        ))}

      <div>
        <h2 className="mb-3 font-semibold">Recent trades</h2>
        {recentTrades.length === 0 ? (
          <p className="text-sm text-zinc-500">No trades yet. Be the first.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {recentTrades.map((t) => {
              const yesNoColor =
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
                  <span>
                    <Link
                      href={`/users/${t.user.username}`}
                      className="font-medium hover:underline"
                    >
                      @{t.user.username}
                    </Link>{" "}
                    {t.shares >= 0 ? "bought" : "sold"} {formatShares(Math.abs(t.shares))}{" "}
                    <span className={yesNoColor}>{labelOf(t.outcome)}</span> for{" "}
                    {formatMoney(Math.abs(t.cost))}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">
                    → {formatPercent(t.probAfter)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CommentSection
        marketId={market.id}
        signedIn={!!userId}
        initial={comments.map((c) => ({
          id: c.id,
          username: c.user.username,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
