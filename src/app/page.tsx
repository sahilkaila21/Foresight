import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { isCategory } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { formatCompact, formatDate, formatPercent, isClosed, nowMs } from "@/lib/format";
import { marketHeadline } from "@/lib/market";
import MarketFilters from "@/components/MarketFilters";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string; sort?: string; category?: string };

const DAY = 24 * 60 * 60 * 1000;

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { q = "", status = "all", sort = "new", category = "" } = await searchParams;
  const nowT = nowMs();
  const now = new Date(nowT);

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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Markets</h1>
      <Suspense>
        <MarketFilters />
      </Suspense>
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
            const badgeColor = !m.resolution
              ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              : m.resolution === "NO"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";

            const endingSoon =
              !m.resolution && !closed && m.closesAt.getTime() - nowT < 2 * DAY;
            const isNew = !m.resolution && nowT - m.createdAt.getTime() < DAY;

            return (
              <li key={m.id}>
                <Link
                  href={`/markets/${m.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{m.question}</p>
                      {endingSoon ? (
                        <Pill className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                          Ending soon
                        </Pill>
                      ) : isNew ? (
                        <Pill className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                          New
                        </Pill>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {formatCompact(m.volume)} Vol
                      </span>{" "}
                      · {m.category} ·{" "}
                      {isCat && `${m.outcomes.length} outcomes · `}
                      {m.resolution
                        ? "resolved"
                        : closed
                          ? "awaiting resolution"
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

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {children}
    </span>
  );
}
