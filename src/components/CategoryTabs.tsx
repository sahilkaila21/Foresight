"use client";

import { Suspense, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/categories";

function Tabs() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const category = params.get("category") ?? "";

  function go(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set("category", next);
    else sp.delete("category");
    startTransition(() => {
      router.push(`/${sp.toString() ? `?${sp.toString()}` : ""}`, { scroll: false });
    });
  }

  const items: [string, string][] = [["", "🔥 Trending"], ...CATEGORIES.map((c) => [c, `${CATEGORY_ICONS[c]} ${c}`] as [string, string])];

  return (
    <div className="scrollbar-none flex gap-5 overflow-x-auto border-t border-zinc-100 px-4 dark:border-zinc-900">
      {items.map(([value, label]) => {
        const active = category === value;
        return (
          <button
            key={value || "trending"}
            onClick={() => go(value)}
            className={`shrink-0 whitespace-nowrap border-b-2 py-2.5 text-sm font-medium transition ${
              active
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function CategoryTabs() {
  return (
    <Suspense>
      <Tabs />
    </Suspense>
  );
}
