import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CATEGORY_ICONS, isCategory } from "@/lib/categories";
import { formatCompact, formatDate, formatPercent, isClosed, nowMs } from "@/lib/format";
import { probYes } from "@/lib/lmsr";
import { pricedOutcomes } from "@/lib/market";
import { teamMeta } from "@/lib/teams";

type MarketWithOutcomes = Prisma.MarketGetPayload<{
  include: { outcomes: true; _count: { select: { trades: true } } };
}>;

const DAY = 24 * 60 * 60 * 1000;
const MAX_ROWS = 3;

export default function MarketCard({ m }: { m: MarketWithOutcomes }) {
  const now = nowMs();
  const closed = isClosed(m.closesAt);
  const isCat = m.kind === "CATEGORICAL";
  const icon = isCategory(m.category) ? CATEGORY_ICONS[m.category] : "🔮";
  const endingSoon = !m.resolution && !closed && m.closesAt.getTime() - now < 2 * DAY;
  const isNew = !m.resolution && now - m.createdAt.getTime() < DAY;

  const rows = isCat
    ? pricedOutcomes(m.outcomes, m.liquidityB)
        .sort((a, z) => z.price - a.price)
        .slice(0, MAX_ROWS)
    : null;
  const extra = isCat ? m.outcomes.length - MAX_ROWS : 0;

  return (
    <Link
      href={`/markets/${m.id}`}
      className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg dark:bg-zinc-900">
          {icon}
        </span>
        <p className="line-clamp-2 flex-1 text-sm font-semibold leading-snug">{m.question}</p>
        {!isCat && (
          <BinaryPill qYes={m.qYes} qNo={m.qNo} b={m.liquidityB} resolution={m.resolution} />
        )}
      </div>

      <div className="mt-3 flex-1 space-y-2">
        {isCat &&
          rows!.map((o) => {
            const isWinner = m.resolution === o.id;
            const color = m.category === "World Cup" ? teamMeta(o.label).color : "#6366f1";
            return (
              <div key={o.id}>
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                    {o.label}
                  </span>
                  {m.resolution ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                        isWinner
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600"
                      }`}
                    >
                      {isWinner ? "Won" : "Lost"}
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {formatPercent(o.price)}
                    </span>
                  )}
                </div>
                {!m.resolution && (
                  <div className="ml-4 mt-1 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(o.price * 100, 2)}%`, backgroundColor: color }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        {isCat && extra > 0 && (
          <p className="pt-0.5 text-xs text-zinc-400">+{extra} more</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-zinc-100 pt-2.5 text-xs text-zinc-500 dark:border-zinc-900">
        <span>{formatCompact(m.volume)} Vol</span>
        <span>·</span>
        <span>{m.category}</span>
        {endingSoon && (
          <Pill className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            Ending soon
          </Pill>
        )}
        {!endingSoon && isNew && (
          <Pill className="ml-auto bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
            New
          </Pill>
        )}
        {!endingSoon && !isNew && (
          <span className="ml-auto">
            {m.resolution ? "resolved" : closed ? "awaiting resolution" : formatDate(m.closesAt)}
          </span>
        )}
      </div>
    </Link>
  );
}

function BinaryPill({
  qYes,
  qNo,
  b,
  resolution,
}: {
  qYes: number;
  qNo: number;
  b: number;
  resolution: string | null;
}) {
  const prob = probYes({ qYes, qNo, b });
  if (resolution) {
    const won = resolution === "YES";
    return (
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
          won
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
            : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
        }`}
      >
        {resolution}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 font-mono text-sm font-bold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
      {formatPercent(prob)}
    </span>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {children}
    </span>
  );
}
