import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney, formatPercent } from "@/lib/format";
import { probYes } from "@/lib/lmsr";
import { pricedOutcomes } from "@/lib/market";
import { getCurrentUser } from "@/lib/session";
import ComboBuilder, { type ComboMarket } from "@/components/ComboBuilder";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  WON: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  LOST: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
};
const LEG_STYLE: Record<string, string> = {
  PENDING: "text-zinc-400",
  WON: "text-emerald-600 dark:text-emerald-400",
  LOST: "text-rose-600 dark:text-rose-400",
};

export default async function CombosPage() {
  const user = await getCurrentUser();
  const now = new Date();

  // Open markets available as legs (cap the list; parlays draw from live ones).
  const open = await prisma.market.findMany({
    where: { resolution: null, closesAt: { gt: now } },
    orderBy: { volume: "desc" },
    take: 60,
    include: { outcomes: true },
  });

  const markets: ComboMarket[] = open.map((m) => {
    if (m.kind === "CATEGORICAL") {
      const priced = pricedOutcomes(m.outcomes, m.liquidityB);
      return {
        id: m.id,
        question: m.question,
        options: priced.map((o) => ({ key: o.id, label: o.label, price: o.price })),
      };
    }
    const p = probYes({ qYes: m.qYes, qNo: m.qNo, b: m.liquidityB });
    return {
      id: m.id,
      question: m.question,
      options: [
        { key: "YES", label: "Yes", price: p },
        { key: "NO", label: "No", price: 1 - p },
      ],
    };
  });

  const combos = user
    ? await prisma.combo.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { legs: true },
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Combos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Parlay several predictions into one bet. All legs must hit to win.
        </p>
      </div>

      <ComboBuilder markets={markets} balance={user?.balance ?? 0} signedIn={!!user} />

      <div>
        <h2 className="mb-3 text-lg font-bold">Your combos</h2>
        {!user ? (
          <p className="text-sm text-zinc-500">
            <Link href="/login" className="underline">
              Log in
            </Link>{" "}
            to place and track combos.
          </p>
        ) : combos.length === 0 ? (
          <p className="text-sm text-zinc-500">No combos yet. Build one above.</p>
        ) : (
          <ul className="space-y-3">
            {combos.map((c) => (
              <li key={c.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[c.status] ?? ""}`}
                    >
                      {c.status}
                    </span>
                    <span className="text-zinc-500">
                      {c.legs.length} legs · {(1 / c.combinedProb).toFixed(2)}×
                    </span>
                  </span>
                  <span className="text-sm">
                    <span className="text-zinc-500">stake </span>
                    <span className="font-mono font-semibold">{formatMoney(c.stake)}</span>
                    <span className="text-zinc-500"> → </span>
                    <span
                      className={`font-mono font-semibold ${
                        c.status === "WON"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : c.status === "LOST"
                            ? "text-rose-600 dark:text-rose-400"
                            : ""
                      }`}
                    >
                      {formatMoney(c.payout)}
                    </span>
                  </span>
                </div>
                <ul className="space-y-1 text-sm">
                  {c.legs.map((l) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <span className={`shrink-0 text-xs font-semibold ${LEG_STYLE[l.result] ?? ""}`}>
                        {l.result === "WON" ? "✓" : l.result === "LOST" ? "✕" : "•"}
                      </span>
                      <Link
                        href={`/markets/${l.marketId}`}
                        className="min-w-0 flex-1 truncate text-zinc-600 hover:underline dark:text-zinc-400"
                      >
                        {l.question}
                      </Link>
                      <span className="shrink-0 font-medium">{l.label}</span>
                      <span className="shrink-0 font-mono text-xs text-zinc-400">
                        {formatPercent(l.entryProb)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
