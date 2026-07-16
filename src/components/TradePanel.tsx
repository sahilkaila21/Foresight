"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, formatPercent, formatShares } from "@/lib/format";
import { buy, sell, type Outcome } from "@/lib/lmsr";

interface Props {
  marketId: string;
  qYes: number;
  qNo: number;
  b: number;
  signedIn: boolean;
  yesShares: number;
  noShares: number;
}

export default function TradePanel({ marketId, qYes, qNo, b, signedIn, yesShares, noShares }: Props) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>("YES");
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = { qYes, qNo, b };
  const num = Number(amount);
  const valid = Number.isFinite(num) && num > 0;
  const held = outcome === "YES" ? yesShares : noShares;

  // Live preview computed with the same LMSR module the server uses
  let preview: string | null = null;
  if (valid) {
    if (mode === "buy") {
      const r = buy(state, outcome, num);
      preview = `≈ ${formatShares(r.shares)} ${outcome} shares · pays ${formatMoney(
        r.shares
      )} if ${outcome} · market moves to ${formatPercent(
        outcome === "YES" ? r.probAfter : 1 - r.probAfter
      )} ${outcome}`;
    } else if (num <= held) {
      const r = sell(state, outcome, num);
      preview = `receive ${formatMoney(-r.cost)} · market moves to ${formatPercent(
        outcome === "YES" ? r.probAfter : 1 - r.probAfter
      )} ${outcome}`;
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload =
      mode === "buy"
        ? { outcome, spend: num }
        : { outcome, sellShares: num };
    const res = await fetch(`/api/markets/${marketId}/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Trade failed");
      return;
    }
    setAmount(mode === "buy" ? "10" : "");
    router.refresh();
  }

  if (!signedIn) {
    return (
      <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
        <Link href="/login" className="underline">
          Log in
        </Link>{" "}
        to trade on this market.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Trade</h2>
        <div className="flex gap-1 text-sm">
          <button
            onClick={() => setMode("buy")}
            className={`rounded px-3 py-1 ${mode === "buy" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500"}`}
          >
            Buy
          </button>
          <button
            onClick={() => {
              setMode("sell");
              setAmount("");
            }}
            className={`rounded px-3 py-1 ${mode === "sell" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500"}`}
          >
            Sell
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {(["YES", "NO"] as const).map((o) => (
          <button
            key={o}
            onClick={() => setOutcome(o)}
            className={`flex-1 rounded-md border px-4 py-2 font-semibold transition ${
              outcome === o
                ? o === "YES"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                : "border-zinc-200 text-zinc-500 dark:border-zinc-800"
            }`}
          >
            {o}
            {mode === "sell" && (
              <span className="ml-1 text-xs font-normal">
                ({formatShares(o === "YES" ? yesShares : noShares)} held)
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs text-zinc-500">
          {mode === "buy" ? "Spend (₱)" : `Shares to sell (max ${formatShares(held)})`}
        </label>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono dark:border-zinc-700"
        />
      </div>

      {preview && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{preview}</p>}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || !valid || (mode === "sell" && num > held)}
        className="mt-4 w-full rounded-md bg-zinc-900 py-2 font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "Trading…" : mode === "buy" ? `Buy ${outcome}` : `Sell ${outcome}`}
      </button>
    </div>
  );
}
