"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, formatPercent, formatShares } from "@/lib/format";
import { buyN, pricesN, sellN } from "@/lib/lmsr";

export interface PanelOutcome {
  id: string;
  label: string;
  q: number;
}

interface Props {
  marketId: string;
  outcomes: PanelOutcome[]; // ordered
  b: number;
  signedIn: boolean;
  holdings: Record<string, number>; // outcomeId -> shares held
}

export default function CategoricalTradePanel({ marketId, outcomes, b, signedIn, holdings }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = outcomes.map((o) => o.q);
  const prices = pricesN(q, b);
  const num = Number(amount);
  const valid = Number.isFinite(num) && num > 0;
  const active = outcomes[selected];
  const held = holdings[active.id] ?? 0;

  let preview: string | null = null;
  if (valid) {
    if (mode === "buy") {
      const r = buyN(q, b, selected, num);
      preview = `≈ ${formatShares(r.shares)} shares · pays ${formatMoney(
        r.shares
      )} if "${active.label}" · moves to ${formatPercent(r.pricesAfter[selected])}`;
    } else if (num <= held) {
      const r = sellN(q, b, selected, num);
      preview = `receive ${formatMoney(-r.cost)} · moves to ${formatPercent(r.pricesAfter[selected])}`;
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload =
      mode === "buy"
        ? { outcomeId: active.id, spend: num }
        : { outcomeId: active.id, sellShares: num };
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

      <div className="mt-4 space-y-1">
        {outcomes.map((o, i) => {
          const h = holdings[o.id] ?? 0;
          return (
            <button
              key={o.id}
              onClick={() => setSelected(i)}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                selected === i
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span className="text-sm font-medium">
                {o.label}
                {mode === "sell" && h > 1e-9 && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {formatShares(h)} held
                  </span>
                )}
              </span>
              <span className="font-mono text-sm text-zinc-500">{formatPercent(prices[i])}</span>
            </button>
          );
        })}
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
        {busy ? "Trading…" : `${mode === "buy" ? "Buy" : "Sell"} "${active.label}"`}
      </button>
    </div>
  );
}
