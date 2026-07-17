import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { isCategory } from "@/lib/categories";
import { prisma } from "@/lib/db";
import MarketCard from "@/components/MarketCard";
import MarketFilters from "@/components/MarketFilters";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string; sort?: string; category?: string };

export default async function HomePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { q = "", status = "all", sort = "new", category = "" } = await searchParams;
  const now = new Date();

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
      <h1 className="mb-4 text-2xl font-bold">{category || "All markets"}</h1>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
            <MarketCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
