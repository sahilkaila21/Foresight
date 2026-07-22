"use client";

import { useState, type ReactNode } from "react";

export interface Tab {
  label: string;
  badge?: number;
  content: ReactNode;
}

/** Comments / Top Holders / Positions / Activity tab bar for a market page. */
export default function MarketTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActive(i)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
              i === active
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-1.5 text-xs text-zinc-400">{t.badge}</span>
            )}
          </button>
        ))}
      </div>
      <div>{tabs[active]?.content}</div>
    </div>
  );
}
