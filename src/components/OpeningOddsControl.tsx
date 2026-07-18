"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OutcomePct {
  id: string;
  label: string;
  percent: number; // current price as a whole-number %
}

interface Props {
  marketId: string;
  outcomes: OutcomePct[];
  hasTrades: boolean;
}

/**
 * Admin-only: set a categorical market's opening odds (starting % per outcome).
 * Locks once trading starts. Inputs prefill with the market's current odds.
 */
export default function OpeningOddsControl({ marketId, outcomes, hasTrades }: Props) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(outcomes.map((o) => [o.id, String(o.percent)]))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const nums = outcomes.map((o) => Number(vals[o.id]));
  const sum = nums.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
  const valid = nums.every((n) => Number.isFinite(n) && n > 0) && Math.abs(sum - 100) < 0.5;

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const oddsPayload = Object.fromEntries(outcomes.map((o) => [o.id, Number(vals[o.id])]));
    const res = await fetch(`/api/markets/${marketId}/opening-odds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ odds: oddsPayload }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErr(data?.error ?? "Failed to set opening odds");
      return;
    }
    setMsg("Opening odds set ✓");
    router.refresh();
  }

  // Opening odds can only be set before the first trade.
  if (hasTrades) return null;

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        🎚️ Admin · Opening odds
      </h2>
      <p className="mt-1 text-xs text-amber-700/70 dark:text-amber-400/60">
        Set the starting chance for each outcome (must total 100%). Locks once trading starts.
      </p>

      <div className="mt-3 space-y-2">
        {outcomes.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm">{o.label}</span>
            <div className="flex shrink-0 items-center gap-1">
              <input
                type="number"
                min="1"
                max="99"
                value={vals[o.id]}
                onChange={(e) => setVals((v) => ({ ...v, [o.id]: e.target.value }))}
                className="w-16 rounded-md border border-amber-300 bg-white px-2 py-1 text-right text-sm outline-none focus:border-amber-500 dark:border-amber-900 dark:bg-zinc-900"
              />
              <span className="text-sm text-zinc-500">%</span>
            </div>
          </div>
        ))}
      </div>

      <div
        className={`mt-2 text-right text-xs ${
          Math.abs(sum - 100) < 0.5
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        Total: {Math.round(sum * 10) / 10}%
      </div>

      <button
        onClick={save}
        disabled={busy || !valid}
        className="mt-2 w-full rounded-md bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
      >
        {busy ? "Saving…" : "Set opening odds"}
      </button>
      {err && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{err}</p>}
      {msg && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}
    </div>
  );
}
