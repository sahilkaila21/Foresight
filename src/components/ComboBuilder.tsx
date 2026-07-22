"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, formatPercent } from "@/lib/format";

export interface ComboOption {
  key: string; // "YES"/"NO" or outcome id
  label: string;
  price: number;
}
export interface ComboMarket {
  id: string;
  question: string;
  options: ComboOption[];
}

interface Leg {
  marketId: string;
  question: string;
  outcome: string;
  label: string;
  price: number;
}

const MAX_LEGS = 8;

/** Parlay builder: pick legs across markets, see the combined odds + payout. */
export default function ComboBuilder({
  markets,
  balance,
  signedIn,
}: {
  markets: ComboMarket[];
  balance: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [query, setQuery] = useState("");
  const [stake, setStake] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chosen = new Set(legs.map((l) => l.marketId));
    return markets
      .filter((m) => !chosen.has(m.id) && (!q || m.question.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [query, markets, legs]);

  const combinedProb = legs.reduce((acc, l) => acc * l.price, 1);
  const stakeNum = Number(stake);
  const stakeValid = Number.isFinite(stakeNum) && stakeNum > 0;
  const multiplier = legs.length > 0 && combinedProb > 0 ? 1 / combinedProb : 0;
  const payout = stakeValid ? stakeNum * multiplier : 0;

  function addLeg(m: ComboMarket) {
    if (legs.length >= MAX_LEGS) return;
    // Default to the leading (most likely) outcome.
    const best = [...m.options].sort((a, b) => b.price - a.price)[0];
    setLegs((prev) => [
      ...prev,
      { marketId: m.id, question: m.question, outcome: best.key, label: best.label, price: best.price },
    ]);
    setQuery("");
  }
  function setLegOutcome(marketId: string, key: string) {
    const m = markets.find((x) => x.id === marketId);
    const opt = m?.options.find((o) => o.key === key);
    if (!opt) return;
    setLegs((prev) =>
      prev.map((l) =>
        l.marketId === marketId ? { ...l, outcome: opt.key, label: opt.label, price: opt.price } : l
      )
    );
  }
  function removeLeg(marketId: string) {
    setLegs((prev) => prev.filter((l) => l.marketId !== marketId));
  }

  async function place() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/combos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stake: stakeNum,
        legs: legs.map((l) => ({ marketId: l.marketId, outcome: l.outcome })),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not place combo");
      return;
    }
    setLegs([]);
    setStake("10");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">🎰 Build a combo</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Stake once across {MAX_LEGS >= 2 ? `2–${MAX_LEGS}` : ""} legs. Every leg must hit to win —
        higher risk, bigger multiplier.
      </p>

      {/* Selected legs */}
      {legs.length > 0 && (
        <ul className="mb-4 space-y-2">
          {legs.map((l) => {
            const m = markets.find((x) => x.id === l.marketId)!;
            return (
              <li
                key={l.marketId}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2.5 text-sm dark:border-zinc-800"
              >
                <span className="min-w-0 flex-1 truncate">{l.question}</span>
                <select
                  value={l.outcome}
                  onChange={(e) => setLegOutcome(l.marketId, e.target.value)}
                  className="shrink-0 rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
                >
                  {m.options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label} ({formatPercent(o.price)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeLeg(l.marketId)}
                  className="shrink-0 rounded-md px-1.5 py-1 text-zinc-400 hover:text-rose-600"
                  aria-label="Remove leg"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add a leg */}
      {legs.length < MAX_LEGS && (
        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets to add a leg…"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          {query.trim() && (
            <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-sm text-zinc-400">No open markets match.</li>
              ) : (
                matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => addLeg(m)}
                      className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      {m.question}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {/* Summary */}
      {legs.length >= 2 && (
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">Combined chance</span>
            <span className="font-mono font-semibold">{formatPercent(combinedProb)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-zinc-500">Multiplier</span>
            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
              {multiplier.toFixed(2)}×
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-zinc-500">Stake ₱</span>
            <input
              type="number"
              min="0"
              step="any"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-24 rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
            />
            <span className="ml-auto text-sm">
              To win{" "}
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formatMoney(payout)}
              </span>
            </span>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <button
        type="button"
        onClick={place}
        disabled={busy || !signedIn || legs.length < 2 || !stakeValid || stakeNum > balance}
        className="mt-4 w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40"
      >
        {!signedIn
          ? "Log in to place a combo"
          : busy
            ? "Placing…"
            : stakeNum > balance
              ? "Insufficient balance"
              : `Place combo · ${formatMoney(payout)} to win`}
      </button>
    </div>
  );
}
