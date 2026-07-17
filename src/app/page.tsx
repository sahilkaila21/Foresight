import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { isCategory } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { openPositionsValue, START_BALANCE } from "@/lib/stats";
import { teamMeta } from "@/lib/teams";
import ActivityFeed, { type ActivityItem } from "@/components/ActivityFeed";
import AutoRefresh from "@/components/AutoRefresh";
import MarketCard from "@/components/MarketCard";
import MarketFilters from "@/components/MarketFilters";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string; sort?: string; category?: string };

function outcomeColor(category: string, label: string): string {
  if (label === "YES") return "#10b981";
  if (label === "NO") return "#ef4444";
  return category === "World Cup" ? teamMeta(label).color : "#6366f1";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { q = "", status = "all", sort = "new", category = "" } = await searchParams;
  const now = new Date();
  const currentUser = await getCurrentUser();

  const where: Prisma.MarketWhereInput = {};
  if (q.trim()) where.question = { contains: q.trim() };
  if (isCategory(category)) where.category = category;
  if (status === "open") where.AND = [{ resolution: null }, { closesAt: { gt: now } }];
  else if (status === "closed") where.AND = [{ resolution: null }, { closesAt: { lte: now } }];
  else if (status === "resolved") where.resolution = { not: null };

  const orderBy: Prisma.MarketOrderByWithRelationInput =
    sort === "volume"
      ? { volume: "desc" }
      : sort === "active"
        ? { trades: { _count: "desc" } }
        : sort === "closing"
          ? { closesAt: "asc" }
          : { createdAt: "desc" };

  const markets = await prisma.market.findMany({
    where,
    orderBy,
    include: {
      creator: { select: { username: true } },
      outcomes: true,
      _count: { select: { trades: true } },
    },
  });

  // Recent activity across all markets.
  const recentTrades = await prisma.trade.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      user: { select: { username: true } },
      market: { select: { id: true, question: true, category: true, outcomes: true } },
    },
  });
  const activity: ActivityItem[] = recentTrades.map((t) => {
    const label =
      t.market.outcomes.find((o) => o.id === t.outcome)?.label ?? t.outcome; // YES/NO for binary
    return {
      id: t.id,
      username: t.user.username,
      bought: t.shares >= 0,
      shares: Math.abs(t.shares),
      cost: t.cost,
      outcomeLabel: label,
      color: outcomeColor(t.market.category, label),
      marketId: t.market.id,
      marketQuestion: t.market.question,
    };
  });

  // Signed-in user's standing (net worth = balance + open positions).
  let standing: { rank: number; total: number; netWorth: number; profit: number } | null = null;
  if (currentUser) {
    const users = await prisma.user.findMany({
      include: {
        positions: {
          where: { shares: { gt: 1e-9 } },
          include: { market: { include: { outcomes: true } } },
        },
      },
    });
    const worths = users
      .map((u) => ({ id: u.id, netWorth: u.balance + openPositionsValue(u.positions) }))
      .sort((a, b) => b.netWorth - a.netWorth);
    const idx = worths.findIndex((w) => w.id === currentUser.id);
    if (idx >= 0) {
      standing = {
        rank: idx + 1,
        total: worths.length,
        netWorth: worths[idx].netWorth,
        profit: worths[idx].netWorth - START_BALANCE,
      };
    }
  }

  const showSidebar = !category && !q.trim() && status === "all";

  return (
    <div>
      {!!markets.length && <AutoRefresh />}
      <h1 className="mb-4 text-2xl font-bold">{category || "All markets"}</h1>
      <Suspense>
        <MarketFilters />
      </Suspense>

      {showSidebar && standing && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4 dark:border-zinc-800 dark:from-indigo-950/30 dark:to-violet-950/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{["🥇", "🥈", "🥉"][standing.rank - 1] ?? "📊"}</span>
            <div>
              <p className="text-sm font-semibold">
                You&apos;re #{standing.rank} of {standing.total}
              </p>
              <p className="text-xs text-zinc-500">
                Net worth <span className="font-mono">{formatMoney(standing.netWorth)}</span> ·{" "}
                <span
                  className={
                    standing.profit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }
                >
                  {standing.profit >= 0 ? "+" : ""}
                  {formatMoney(standing.profit)}
                </span>
              </p>
            </div>
          </div>
          <Link
            href="/leaderboard"
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:border-zinc-400 dark:border-zinc-700"
          >
            Leaderboard →
          </Link>
        </div>
      )}

      {showSidebar && activity.length > 0 && (
        <div className="mb-5">
          <ActivityFeed items={activity} />
        </div>
      )}
      {markets.length === 0 ? (
        <p className="text-zinc-500">
          {q.trim() || status !== "all" || category ? (
            "No markets match these filters."
          ) : (
            <>
              No markets yet.{" "}
              <Link href="/markets/new" className="underline">
                Create the first one
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
            <MarketCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
