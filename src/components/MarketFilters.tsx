"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUSES = [
  ["all", "All"],
  ["open", "Open"],
  ["closed", "Closed"],
  ["resolved", "Resolved"],
] as const;

const SORTS = [
  ["new", "Newest"],
  ["volume", "Volume"],
  ["active", "Most active"],
  ["closing", "Closing soon"],
] as const;

export default function MarketFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const status = params.get("status") ?? "all";
  const sort = params.get("sort") ?? "new";

  function update(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-1">
        {STATUSES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => update({ status: key === "all" ? "" : key })}
            className={`rounded-full px-3 py-1 text-sm transition ${
              status === key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-500">
        Sort
        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value === "new" ? "" : e.target.value })}
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        >
          {SORTS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
