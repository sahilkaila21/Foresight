"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, formatPercent, formatShares } from "@/lib/format";
import { buy, probYes, sell, type Outcome } from "@/lib/lmsr";

interface Props {
  marketId: string;
  qYes: number;
  qNo: number;
  b: number;
  signedIn: boolean;
  balance: number;
  yesShares: number;
  noShares: number;
}

const QUICK_ADD = [10, 50, 100, 500];

export default function TradePanel({
  marketId,
  qYes,
  qNo,
  b,
  signedIn,
  balance,
  yesShares,
  noShares,
}: Props) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>("YES");
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = { qYes, qNo, b };
  const num = Number(amount);
  const valid = Number.isFinite(num) && num > 0;
  const held = outcome === "YES" ? yesShares : noShares;
  const yesPrice = probYes(state);

  function addAmount(delta: number) {
    setAmount(String(Math.max(0, Math.round(((Number(amount) || 0) + delta) * 100) / 100)));
  }
  function setMax() {
    setAmount(String(Math.floor((mode === "buy" ? balance : held) * 100) / 100));
  }

  // Live preview computed with the same LMSR module the server uses.
  let buyResult: ReturnType<typeof buy> | null = null;
  let sellResult: ReturnType<typeof sell> | null = null;
  if (valid) {
    if (mode === "buy") buyResult = buy(state, outcome, num);
    else if (num <= held) sellResult = sell(state, outcome, num);
  }
  const priceAfter = (probYesAfter: number) => (outcome === "YES" ? probYesAfter : 1 - probYesAfter);
  const returnPct = buyResult && num > 0 ? ((buyResult.shares - num) / num) * 100 : 0;

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = mode === "buy" ? { outcome, spend: num } : { outcome, sellShares: num };
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

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
        <Link href="/login" className="underline">
          Log in
        </Link>{" "}
        to trade on this market.
      </div>
    );
  }

  const submitColor =
    outcome === "YES"
      ? "bg-emerald-600 hover:bg-emerald-500"
      : "bg-rose-600 hover:bg-rose-500";

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex border-b border-zinc-100 text-sm font-semibold dark:border-zinc-900">
        <button
          onClick={() => setMode("buy")}
          className={`-mb-px border-b-2 px-1 pb-2 mr-5 ${mode === "buy" ? "border-zinc-900 dark:border-white" : "border-transparent text-zinc-400"}`}
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(["YES", "NO"] as const).map((o) => {
          const price = o === "YES" ? yesPrice : 1 - yesPrice;
          const selected = outcome === o;
          return (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={`rounded-lg py-3 text-center font-semibold transition ${
                selected
                  ? o === "YES"
                    ? "bg-emerald-600 text-white"
                    : "bg-rose-600 text-white"
                  : o === "YES"
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400"
              }`}
            >
              {o === "YES" ? "Yes" : "No"} {(price * 100).toFixed(1)}¢
              {mode === "sell" && (
                <span className="block text-xs font-normal opacity-80">
                  {formatShares(o === "YES" ? yesShares : noShares)} held
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{mode === "buy" ? "Amount" : `Shares to sell (max ${formatShares(held)})`}</span>
          {mode === "buy" && <span>Balance {formatMoney(balance)}</span>}
        </div>
        <div className="mt-1 flex items-center justify-center py-3">
          {mode === "buy" && <span className="text-3xl font-bold text-zinc-300 dark:text-zinc-700">₱</span>}
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
        <div className="mt-4 space-y-0.5 text-sm">
          <p className="text-zinc-500">
            ≈ {formatShares(buyResult.shares)} {outcome} shares · moves to{" "}
            {formatPercent(priceAfter(buyResult.probAfter))} {outcome}
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
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Receive {formatMoney(-sellResult.cost)} · moves to{" "}
          {formatPercent(priceAfter(sellResult.probAfter))} {outcome}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || !valid || (mode === "sell" && num > held)}
        className={`mt-4 w-full rounded-xl py-3 font-bold text-white transition disabled:opacity-40 ${submitColor}`}
      >
        {busy ? "Trading…" : mode === "buy" ? `Buy ${outcome === "YES" ? "Yes" : "No"}` : `Sell ${outcome === "YES" ? "Yes" : "No"}`}
      </button>
    </div>
  );
}
