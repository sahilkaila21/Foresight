"use client";

import { useState } from "react";

/**
 * One-time banner shown to a user after an admin resets the markets, asking
 * them to place their bets again. Dismissing it clears the flag server-side so
 * it won't show on future visits.
 */
export default function ResetNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  async function dismiss() {
    setDismissed(true);
    await fetch("/api/notice/dismiss", { method: "POST" }).catch(() => {});
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5 text-sm">
        <span aria-hidden className="text-lg leading-none">
          🛠️
        </span>
        <p className="flex-1 text-amber-800 dark:text-amber-200">
          <span className="font-semibold">Sorry — we had to reset the markets after a technical bug.</span>{" "}
          Your balance is back to ₱1,000 and previous bets were cleared. Please place your bets again!
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded px-1.5 text-lg leading-none text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
