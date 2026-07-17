"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, formatPercent, formatShares } from "@/lib/format";
import { buyN, pricesN, sellN } from "@/lib/lmsr";
import { COLORS } from "./MultiProbChart";

export interface PanelOutcome {
  id: string;
  label: string;
  q: number;
}

interface Props {
  marketId: string;
  outcomes: PanelOutcome[]; // ordered
  b: number;
  resolution: string | null;
  tradable: boolean; // market open for trading (not closed, not resolved)
  signedIn: boolean;
  balance: number;
  holdings: Record<string, number>; // outcomeId -> shares held
}

const QUICK_ADD = [10, 50, 100, 500];

export default function CategoricalTradePanel({
  marketId,
  outcomes,
  b,
  resolution,
  tradable,
  signedIn,
  balance,
  holdings,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = outcomes.map((o) => o.q);
  const prices = pricesN(q, b);
  const num = Number(amount);
  const valid = Number.isFinite(num) && num > 0;
  const active = outcomes[selected];
  const held = holdings[active.id] ?? 0;

  function addAmount(delta: number) {
    setAmount(String(Math.max(0, Math.round(((Number(amount) || 0) + delta) * 100) / 100)));
  }
  function setMax() {
    setAmount(String(Math.floor((mode === "buy" ? balance : held) * 100) / 100));
  }

  let buyResult: ReturnType<typeof buyN> | null = null;
  let sellResult: ReturnType<typeof sellN> | null = null;
  if (valid) {
    if (mode === "buy") buyResult = buyN(q, b, selected, num);
    else if (num <= held) sellResult = sellN(q, b, selected, num);
  }
  const returnPct = buyResult && num > 0 ? ((buyResult.shares - num) / num) * 100 : 0;

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
    setAmount("0");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {outcomes.map((o, i) => {
          const won = resolution === o.id;
          const isSel = selected === i;
          const color = COLORS[i % COLORS.length];
          const clickable = tradable && signedIn && !resolution;
          const RowTag = clickable ? "button" : "div";
          return (
            <RowTag
              key={o.id}
              {...(clickable ? { type: "button" as const, onClick: () => setSelected(i) } : {})}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                clickable ? "cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600" : ""
              } ${
                isSel && tradable
                  ? "border-zinc-300 ring-1 ring-zinc-200 dark:border-zinc-600 dark:ring-zinc-700"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.label}</span>
              {resolution ? (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    won
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600"
                  }`}
                >
                  {won ? "Won" : "Lost"}
                </span>
              ) : (
                <>
                  <span className="w-10 shrink-0 text-right font-mono text-sm text-zinc-500">
                    {formatPercent(prices[i])}
                  </span>
                  {clickable && (
                    <span
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        isSel
                          ? "text-white"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      }`}
                      style={isSel ? { backgroundColor: color } : undefined}
                    >
                      {isSel ? "Selected" : "Buy"}
                    </span>
                  )}
                </>
              )}
            </RowTag>
          );
        })}
      </div>

      {tradable &&
        (signedIn ? (
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[selected % COLORS.length] }}
              />
              <span className="font-semibold">{active.label}</span>
            </div>

            <div className="mt-3 flex border-b border-zinc-100 text-sm font-semibold dark:border-zinc-900">
              <button
                onClick={() => setMode("buy")}
                className={`-mb-px mr-5 border-b-2 px-1 pb-2 ${mode === "buy" ? "border-zinc-900 dark:border-white" : "border-transparent text-zinc-400"}`}
              >
                Buy
              </button>
              <button
                onClick={() => {
                  setMode("sell");
                  setAmount("0");
                }}
                className={`-mb-px border-b-2 px-1 pb-2 ${mode === "sell" ? "border-zinc-900 dark:border-white" : "border-transparent text-zinc-400"}`}
              >
                Sell
              </button>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {mode === "buy" ? "Amount" : `Shares to sell (max ${formatShares(held)})`}
                </span>
                {mode === "buy" && <span>Balance {formatMoney(balance)}</span>}
              </div>
              <div className="mt-1 flex items-center justify-center py-3">
                {mode === "buy" && (
                  <span className="text-3xl font-bold text-zinc-300 dark:text-zinc-700">₱</span>
                )}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-32 bg-transparent text-center text-3xl font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="flex gap-1.5">
                {mode === "buy" &&
                  QUICK_ADD.map((d) => (
                    <button
                      key={d}
                      onClick={() => addAmount(d)}
                      className="flex-1 rounded-md border border-zinc-200 py-1 text-xs text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400"
                    >
                      +₱{d}
                    </button>
                  ))}
                <button
                  onClick={setMax}
                  className="flex-1 rounded-md border border-zinc-200 py-1 text-xs text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400"
                >
                  Max
                </button>
              </div>
            </div>

            {buyResult && (
              <div className="mt-3 space-y-0.5 text-sm">
                <p className="text-zinc-500">
                  ≈ {formatShares(buyResult.shares)} shares · moves to{" "}
                  {formatPercent(buyResult.pricesAfter[selected])}
                </p>
                <p>
                  <span className="text-zinc-500">To win</span>{" "}
                  <span className="font-semibold">{formatMoney(buyResult.shares)}</span>{" "}
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    ▲ {Math.round(returnPct)}% return
                  </span>
                </p>
              </div>
            )}
            {sellResult && (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                Receive {formatMoney(-sellResult.cost)} · moves to{" "}
                {formatPercent(sellResult.pricesAfter[selected])}
              </p>
            )}
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

            <button
              onClick={submit}
              disabled={busy || !valid || (mode === "sell" && num > held)}
              className="mt-4 w-full rounded-xl py-3 font-bold text-white transition disabled:opacity-40"
              style={{ backgroundColor: COLORS[selected % COLORS.length] }}
            >
              {busy ? "Trading…" : `${mode === "buy" ? "Buy" : "Sell"} "${active.label}"`}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
            <Link href="/login" className="underline">
              Log in
            </Link>{" "}
            to trade on this market.
          </div>
        ))}
    </div>
  );
}
