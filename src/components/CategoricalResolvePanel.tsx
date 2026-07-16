"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CategoricalResolvePanel({
  marketId,
  outcomes,
}: {
  marketId: string;
  outcomes: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; label: string } | null>(null);

  async function resolve(outcomeId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/markets/${marketId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcomeId }),
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
        You created this market. Pick the winning outcome — every winning share pays ₱1 and this
        cannot be undone.
      </p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span>
            Resolve <strong>{confirming.label}</strong>?
          </span>
          <button
            onClick={() => resolve(confirming.id)}
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
        <div className="mt-3 flex flex-wrap gap-2">
          {outcomes.map((o) => (
            <button
              key={o.id}
              onClick={() => setConfirming(o)}
              className="rounded-md border border-zinc-400 px-4 py-1.5 text-sm font-semibold hover:border-zinc-900 dark:border-zinc-600 dark:hover:border-zinc-100"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
