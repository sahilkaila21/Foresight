"use client";

import type { Range } from "@/lib/history";

const RANGES: Range[] = ["1D", "1W", "1M", "ALL"];

/** Small 1D / 1W / 1M / ALL selector shared by the chart wrappers. */
export default function RangeTabs({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`rounded-md px-2 py-0.5 text-xs font-semibold transition ${
            value === r
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
