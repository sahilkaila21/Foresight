"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, formatPercent, formatShares } from "@/lib/format";
import { buyN, pricesN, sellN } from "@/lib/lmsr";
import { flagUrl, teamMeta } from "@/lib/teams";

export interface MatchOutcome {
  id: string;
  label: string;
  q: number;
}

interface Props {
  marketId: string;
  outcomes: MatchOutcome[]; // exactly two, ordered
  b: number;
  signedIn: boolean;
  balance: number;
  holdings: Record<string, number>; // outcomeId -> shares held
}

const QUICK_ADD = [10, 50, 100, 500];

export default function MatchTradePanel({
  marketId,
  outcomes,
  b,
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
  const activeMeta = teamMeta(active.label);
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
    <div className="rounded-2xl border border-zinc-200 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header: which side you're backing */}
      <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={flagUrl(activeMeta.code, 80)}
          alt={`${active.label} flag`}
          width={40}
          height={30}
          className="h-7 w-10 rounded object-cover ring-1 ring-black/5"
        />
        <div>
          <div className="text-xs text-zinc-500">Team to win</div>
          <div className="font-semibold">{active.label}</div>
        </div>
      </div>

      {/* Buy / Sell + order type */}
      <div className="mt-3 flex items-center justify-between border-b border-zinc-100 text-sm font-semibold dark:border-zinc-900">
        <div className="flex">
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
        <span className="pb-2 text-xs font-medium text-zinc-400">Market</span>
      </div>

      {/* Two team buttons */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {outcomes.map((o, i) => {
          const meta = teamMeta(o.label);
          const isSel = selected === i;
          return (
            <button
              key={o.id}
              onClick={() => setSelected(i)}
              className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition ${
                isSel ? "text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
              style={isSel ? { backgroundColor: meta.color } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={flagUrl(meta.code, 40)}
                alt=""
                width={20}
                height={15}
                className="h-3.5 w-5 rounded-sm object-cover ring-1 ring-black/10"
              />
              {o.label} {(prices[i] * 100).toFixed(0)}¢
            </button>
          );
        })}
      </div>

      {/* Amount */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">
            {mode === "buy" ? "Amount" : `Shares (max ${formatShares(held)})`}
          </span>
          <div className="flex items-baseline gap-1">
            {mode === "buy" && <span className="text-2xl font-bold text-zinc-300 dark:text-zinc-700">₱</span>}
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 bg-transparent text-right text-3xl font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
        {mode === "buy" && (
          <div className="mt-1 text-right text-xs text-zinc-400">Balance {formatMoney(balance)}</div>
        )}
        <div className="mt-3 flex gap-1.5">
          {mode === "buy" &&
            QUICK_ADD.map((d) => (
              <button
                key={d}
                onClick={() => addAmount(d)}
                className="flex-1 rounded-md border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400"
              >
                +₱{d}
              </button>
            ))}
          <button
            onClick={setMax}
            className="flex-1 rounded-md border border-zinc-200 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400"
          >
            Max
          </button>
        </div>
      </div>

      {buyResult && (
        <div className="mt-4 space-y-0.5 text-sm">
          <p className="text-zinc-500">
            ≈ {formatShares(buyResult.shares)} shares · moves to{" "}
            {formatPercent(buyResult.pricesAfter[selected])}
          </p>
          <p>
            <span className="text-zinc-500">To win</span>{" "}
            <span className="font-semibold">{formatMoney(buyResult.shares)}</span>{" "}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              ▲ {Math.round(returnPct)}%
            </span>
          </p>
        </div>
      )}
      {sellResult && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Receive {formatMoney(-sellResult.cost)} · moves to{" "}
          {formatPercent(sellResult.pricesAfter[selected])}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

      {signedIn ? (
        <button
          onClick={submit}
          disabled={busy || !valid || (mode === "sell" && num > held)}
          className="mt-4 w-full rounded-xl py-3 font-bold text-white transition disabled:opacity-40"
          style={{ backgroundColor: activeMeta.color }}
        >
          {busy ? "Trading…" : mode === "buy" ? `Buy ${active.label}` : `Sell ${active.label}`}
        </button>
      ) : (
        <Link
          href="/login"
          className="mt-4 block w-full rounded-xl bg-zinc-900 py-3 text-center font-bold text-white dark:bg-white dark:text-zinc-900"
        >
          Log in to trade
        </Link>
      )}

      <p className="mt-3 text-center text-xs text-zinc-400">Play money · trade on what you believe</p>
    </div>
  );
}
