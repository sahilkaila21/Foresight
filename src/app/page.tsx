import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDate, formatPercent, isClosed, nowMs } from "@/lib/format";
import { marketHeadline } from "@/lib/market";
import MarketFilters from "@/components/MarketFilters";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string; sort?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { q = "", status = "all", sort = "new" } = await searchParams;
  const now = new Date(nowMs());

  const where: Prisma.MarketWhereInput = {};
  if (q.trim()) where.question = { contains: q.trim() };
  if (status === "open") where.AND = [{ resolution: null }, { closesAt: { gt: now } }];
  else if (status === "closed") where.AND = [{ resolution: null }, { closesAt: { lte: now } }];
  else if (status === "resolved") where.resolution = { not: null };

  const orderBy: Prisma.MarketOrderByWithRelationInput =
    sort === "active"
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Markets</h1>
      <Suspense>
        <MarketFilters />
      </Suspense>
      {markets.length === 0 ? (
        <p className="text-zinc-500">
          {q.trim() || status !== "all" ? (
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
        <ul className="space-y-3">
          {markets.map((m) => {
            const closed = isClosed(m.closesAt);
            const isCat = m.kind === "CATEGORICAL";
            const headline = marketHeadline(m);
            const resolvedLabel = m.resolution
              ? isCat
                ? (m.outcomes.find((o) => o.id === m.resolution)?.label ?? m.resolution)
                : m.resolution
              : null;
            // Losing binary resolution shows red; every other resolved badge (a
            // winning outcome) shows green; unresolved shows neutral.
            const badgeColor = !m.resolution
              ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              : m.resolution === "NO"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
            return (
              <li key={m.id}>
                <Link
                  href={`/markets/${m.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.question}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      by @{m.creator.username} · {m._count.trades} trades ·{" "}
                      {isCat && `${m.outcomes.length} outcomes · `}
                      {m.resolution
                        ? "resolved"
                        : closed
                          ? "closed, awaiting resolution"
                          : `closes ${formatDate(m.closesAt)}`}
                    </p>
                    {isCat && !m.resolution && headline.label !== "—" && (
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        “{headline.label}” leading
                      </p>
                    )}
                  </div>
                  <span
                    className={`max-w-[8rem] shrink-0 truncate rounded-full px-3 py-1 text-sm font-bold ${badgeColor} ${
                      resolvedLabel ? "" : "font-mono"
                    }`}
                  >
                    {resolvedLabel ?? formatPercent(headline.prob)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
