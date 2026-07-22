"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Market Context" — a longer analysis paragraph explaining what's driving the
 * odds (like Polymarket's). Read-only for everyone; the creator/admin gets an
 * inline editor to write or update it.
 */
export default function MarketContext({
  marketId,
  context,
  canEdit,
}: {
  marketId: string;
  context: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(context);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!context && !canEdit) return null;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/markets/${marketId}/context`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: draft }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to save");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <span>🧠</span> Market Context
        </h2>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(context);
              setEditing(true);
            }}
            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {context ? "Edit" : "Add context"}
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder="Explain what's driving these odds — key news, base rates, recent moves…"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : context ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {context}
        </p>
      ) : (
        <p className="text-sm text-zinc-400">No context written yet.</p>
      )}
    </div>
  );
}
