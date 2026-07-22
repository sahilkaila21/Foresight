import Link from "next/link";
import { redirect } from "next/navigation";
import { cardData } from "@/lib/cards";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import MarketCard from "@/components/MarketCard";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await prisma.watchlist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      market: {
        include: {
          creator: { select: { username: true } },
          outcomes: true,
          _count: { select: { trades: true } },
        },
      },
    },
  });
  const markets = rows.map((r) => r.market);
  const { watched, changes } = await cardData(user.id, markets);

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
        <span className="text-amber-500">★</span> Watchlist
      </h1>
      {markets.length === 0 ? (
        <p className="text-zinc-500">
          You&apos;re not watching any markets yet. Tap the ☆ on any market to save it here.{" "}
          <Link href="/" className="underline">
            Browse markets
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
            <MarketCard
              key={m.id}
              m={m}
              watching={watched.has(m.id)}
              signedIn
              change24h={changes.get(m.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
