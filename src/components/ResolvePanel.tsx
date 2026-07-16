"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResolvePanel({ marketId }: { marketId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"YES" | "NO" | null>(null);

  async function resolve(outcome: "YES" | "NO") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/markets/${marketId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    setBusy(false);
    setConfirming(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Resolution failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <h2 className="font-semibold">Resolve market</h2>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        You created this market. Resolving pays every winning share ₱1 and cannot be undone.
      </p>
      {confirming ? (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span>
            Resolve <strong>{confirming}</strong>?
          </span>
          <button
            onClick={() => resolve(confirming)}
            disabled={busy}
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "Resolving…" : "Confirm"}
          </button>
          <button onClick={() => setConfirming(null)} className="text-zinc-500 underline">
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setConfirming("YES")}
            className="rounded-md border border-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
          >
            Resolve YES
          </button>
          <button
            onClick={() => setConfirming("NO")}
            className="rounded-md border border-rose-500 px-4 py-1.5 text-sm font-semibold text-rose-700 dark:text-rose-400"
          >
            Resolve NO
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
