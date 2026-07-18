"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Outcome {
  id: string;
  label: string;
}

interface Props {
  marketId: string;
  outcomes: Outcome[];
  hasTrades: boolean; // player list locks once trading starts
}

/**
 * Admin-only control panel for a categorical "award" market (e.g. Golden Boot).
 * Two jobs: manage the candidate players (add/remove, before trading starts)
 * and declare the winner (resolves the market and pays out holders).
 */
export default function AwardAdminControl({ marketId, outcomes, hasTrades }: Props) {
  const router = useRouter();
  const [newPlayer, setNewPlayer] = useState("");
  const [winner, setWinner] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(url: string, opts: RequestInit, busyKey: string) {
    setBusy(busyKey);
    setErr(null);
    setMsg(null);
    const res = await fetch(url, opts);
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErr(data?.error ?? "Something went wrong");
      return false;
    }
    return true;
  }

  async function addPlayer() {
    const label = newPlayer.trim();
    if (!label) return;
    const ok = await call(
      `/api/markets/${marketId}/outcomes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      },
      "add"
    );
    if (ok) {
      setNewPlayer("");
      setMsg(`Added ${label}`);
      router.refresh();
    }
  }

  async function removePlayer(o: Outcome) {
    if (!confirm(`Remove ${o.label} from this market?`)) return;
    const ok = await call(
      `/api/markets/${marketId}/outcomes/${o.id}`,
      { method: "DELETE" },
      `del-${o.id}`
    );
    if (ok) {
      setMsg(`Removed ${o.label}`);
      router.refresh();
    }
  }

  async function declareWinner() {
    if (!winner) return;
    const label = outcomes.find((o) => o.id === winner)?.label ?? "this outcome";
    if (!confirm(`Declare "${label}" the winner and pay out holders? This can't be undone.`)) return;
    const ok = await call(
      `/api/markets/${marketId}/admin-resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: winner }),
      },
      "resolve"
    );
    if (ok) {
      setMsg(`Resolved: ${label} won`);
      router.refresh();
    }
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        🛠️ Admin · Manage event
      </h2>

      {/* Manage players */}
      <div className="mt-3">
        <div className="text-xs font-medium text-amber-700/80 dark:text-amber-400/80">Players</div>
        <ul className="mt-2 space-y-1">
          {outcomes.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between rounded-md bg-white/60 px-3 py-1.5 text-sm dark:bg-zinc-900/40"
            >
              <span>{o.label}</span>
              {!hasTrades && outcomes.length > 2 && (
                <button
                  onClick={() => removePlayer(o)}
                  disabled={busy === `del-${o.id}`}
                  className="rounded px-2 text-lg leading-none text-zinc-400 hover:text-rose-600 disabled:opacity-40"
                  aria-label={`Remove ${o.label}`}
                  title={`Remove ${o.label}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>

        {hasTrades ? (
          <p className="mt-2 text-xs text-amber-700/70 dark:text-amber-400/60">
            Player list is locked — trading has started.
          </p>
        ) : (
          <div className="mt-2 flex gap-2">
            <input
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="Add a player…"
              className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-amber-900 dark:bg-zinc-900"
            />
            <button
              onClick={addPlayer}
              disabled={busy === "add" || !newPlayer.trim()}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Declare winner */}
      <div className="mt-4 border-t border-amber-200 pt-3 dark:border-amber-900/60">
        <div className="text-xs font-medium text-amber-700/80 dark:text-amber-400/80">
          Declare winner
        </div>
        <div className="mt-2 flex gap-2">
          <select
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-amber-900 dark:bg-zinc-900"
          >
            <option value="">Pick the winner…</option>
            {outcomes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={declareWinner}
            disabled={busy === "resolve" || !winner}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            {busy === "resolve" ? "Resolving…" : "Resolve"}
          </button>
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{err}</p>}
      {msg && <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}
    </div>
  );
}
