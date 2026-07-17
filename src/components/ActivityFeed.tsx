import Link from "next/link";
import { formatMoney } from "@/lib/format";

export interface ActivityItem {
  id: string;
  username: string;
  bought: boolean;
  shares: number;
  cost: number;
  outcomeLabel: string;
  color: string;
  marketId: string;
  marketQuestion: string;
}

/** Compact "who's betting" strip across all markets, for the homepage. */
export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
        Live activity
      </h2>
      <ul className="space-y-1.5">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-sm">
            <Link href={`/users/${a.username}`} className="shrink-0 font-medium hover:underline">
              @{a.username}
            </Link>
            <span className="shrink-0 text-zinc-500">{a.bought ? "backed" : "sold"}</span>
            <span
              className="inline-flex shrink-0 items-center gap-1 font-semibold"
              style={{ color: a.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.color }} />
              {a.outcomeLabel}
            </span>
            <Link
              href={`/markets/${a.marketId}`}
              className="min-w-0 flex-1 truncate text-zinc-400 hover:underline"
            >
              {a.marketQuestion}
            </Link>
            <span className="shrink-0 font-mono text-xs text-zinc-500">
              {formatMoney(Math.abs(a.cost))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
