"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Star toggle to add/remove a market from the signed-in user's watchlist.
 * `size` picks between the compact card corner button and the larger detail one.
 */
export default function WatchButton({
  marketId,
  initialWatching,
  signedIn,
  size = "sm",
}: {
  marketId: string;
  initialWatching: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [watching, setWatching] = useState(initialWatching);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // Cards wrap the button in a <Link>; don't navigate when starring.
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !watching;
    setWatching(next); // optimistic
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketId }),
    });
    setBusy(false);
    if (!res.ok) {
      setWatching(!next); // revert
      return;
    }
    const data = await res.json().catch(() => null);
    if (data && typeof data.watching === "boolean") setWatching(data.watching);
    router.refresh();
  }

  const dim = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={watching}
      aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}
      title={watching ? "In your watchlist" : "Add to watchlist"}
      className={`shrink-0 rounded-full p-1 transition ${
        watching
          ? "text-amber-500 hover:text-amber-600"
          : "text-zinc-300 hover:text-amber-400 dark:text-zinc-600 dark:hover:text-amber-400"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={dim}
        fill={watching ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      >
        <path d="M12 2.5l2.9 6.06 6.6.86-4.85 4.55 1.24 6.58L12 17.9l-5.89 3.11 1.24-6.58L2.5 9.42l6.6-.86L12 2.5z" />
      </svg>
    </button>
  );
}
