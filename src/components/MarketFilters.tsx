"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";

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
  const category = params.get("category") ?? "";
  const [search, setSearch] = useState(params.get("q") ?? "");

  // Push a new query string, preserving the params we aren't changing.
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

  // Debounce the search box so we aren't navigating on every keystroke.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const id = setTimeout(() => update({ q: search }), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="mb-6 space-y-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search markets…"
        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
      />
      <div className="flex flex-wrap gap-1.5">
        <Chip active={category === ""} onClick={() => update({ category: "" })}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => update({ category: c })}>
            {c}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {STATUSES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => update({ status: key === "all" ? "" : key })}
              className={`rounded-md px-3 py-1 text-sm transition ${
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
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}
