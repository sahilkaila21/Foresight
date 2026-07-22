"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, formatShares } from "@/lib/format";

interface Order {
  id: string;
  outcome: string;
  side: string;
  limitProb: number;
  spend: number;
  shares: number;
  status: string;
  createdAt: string;
}

/** The signed-in user's own resting limit orders on this market, with cancel. */
export default function LimitOrdersList({ marketId }: { marketId: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/markets/${marketId}/limit-orders`);
    if (!res.ok) return;
    const data = await res.json();
    setOrders(data.items ?? []);
  }, [marketId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const onChange = () => load();
    window.addEventListener("limit-orders-changed", onChange);
    const t = setInterval(load, 12_000);
    return () => {
      window.removeEventListener("limit-orders-changed", onChange);
      clearInterval(t);
    };
  }, [load]);

  const open = orders.filter((o) => o.status === "OPEN");
  if (open.length === 0) return null;

  async function cancel(id: string) {
    const res = await fetch(`/api/limit-orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-3 font-semibold">Your open limit orders</h2>
      <ul className="space-y-2 text-sm">
        {open.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3">
            <span>
              <span
                className={`font-semibold ${
                  o.side === "BUY"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {o.side === "BUY" ? "Buy" : "Sell"}
              </span>{" "}
              {o.outcome}{" "}
              {o.side === "BUY"
                ? `${formatMoney(o.spend)} when ≤ ${Math.round(o.limitProb * 100)}¢`
                : `${formatShares(o.shares)} shares when ≥ ${Math.round(o.limitProb * 100)}¢`}
            </span>
            <button
              type="button"
              onClick={() => cancel(o.id)}
              className="shrink-0 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:border-rose-300 hover:text-rose-600 dark:border-zinc-800"
            >
              Cancel
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
