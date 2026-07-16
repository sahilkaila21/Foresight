import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, formatPercent, formatShares, isClosed, nowMs } from "@/lib/format";
import { probYes } from "@/lib/lmsr";
import { getSessionUserId } from "@/lib/session";
import CommentSection from "@/components/CommentSection";
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
      trades: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { username: true } } },
      },
    },
  });
  if (!market) notFound();

  const userId = await getSessionUserId();
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

  const p = probYes({ qYes: market.qYes, qNo: market.qNo, b: market.liquidityB });
  const open = !market.resolution && !isClosed(market.closesAt);

  // Step-line history: 50% at creation, one point per trade, flat to "now"
  const endT = market.resolvedAt?.getTime() ?? nowMs();
  const chartPoints = [
    { t: market.createdAt.getTime(), p: 0.5 },
    ...market.trades.map((t) => ({ t: t.createdAt.getTime(), p: t.probAfter })),
    { t: endT, p },
  ];
  const recentTrades = market.trades.slice(-30).reverse();

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between gap-6">
          <h1 className="text-2xl font-bold">{market.question}</h1>
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
              {market.resolution ?? formatPercent(p)}
            </div>
            <div className="text-xs text-zinc-500">
              {market.resolution ? "resolved" : "chance of YES"}
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          by @{market.creator.username} ·{" "}
          {market.resolution
            ? `resolved ${market.resolution} on ${formatDate(market.resolvedAt!)}`
            : open
              ? `closes ${formatDate(market.closesAt)}`
              : "closed, awaiting resolution"}
        </p>
        {market.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {market.description}
          </p>
        )}
      </div>

      {market.trades.length > 0 && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <ProbChart points={chartPoints} />
        </div>
      )}

      {positions.length > 0 && (
        <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h2 className="mb-2 font-semibold">Your position</h2>
          {positions.map((pos) => (
            <p key={pos.id} className="text-zinc-600 dark:text-zinc-400">
              {formatShares(pos.shares)} {pos.outcome} shares — pays{" "}
              {formatMoney(pos.shares)} if {pos.outcome}
            </p>
          ))}
        </div>
      )}

      {open && (
        <TradePanel
          marketId={market.id}
          qYes={market.qYes}
          qNo={market.qNo}
          b={market.liquidityB}
          signedIn={!!userId}
          yesShares={positions.find((x) => x.outcome === "YES")?.shares ?? 0}
          noShares={positions.find((x) => x.outcome === "NO")?.shares ?? 0}
        />
      )}

      {!market.resolution && userId === market.creatorId && (
        <ResolvePanel marketId={market.id} />
      )}

      <div>
        <h2 className="mb-3 font-semibold">Recent trades</h2>
        {recentTrades.length === 0 ? (
          <p className="text-sm text-zinc-500">No trades yet. Be the first.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {recentTrades.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between border-b border-zinc-100 py-2 dark:border-zinc-900"
              >
                <span>
                  <span className="font-medium">@{t.user.username}</span>{" "}
                  {t.shares >= 0 ? "bought" : "sold"} {formatShares(Math.abs(t.shares))}{" "}
                  <span
                    className={
                      t.outcome === "YES"
                        ? "font-semibold text-emerald-600 dark:text-emerald-400"
                        : "font-semibold text-rose-600 dark:text-rose-400"
                    }
                  >
                    {t.outcome}
                  </span>{" "}
                  for {formatMoney(Math.abs(t.cost))}
                </span>
                <span className="font-mono text-xs text-zinc-500">
                  → {formatPercent(t.probAfter)}
                </span>
              </li>
            ))}
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
