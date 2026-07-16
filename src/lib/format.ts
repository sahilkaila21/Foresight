/** Formatting helpers shared by server and client components. */

export function formatPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function formatMoney(n: number): string {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatShares(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** Current time in epoch ms (kept out of component render for the purity lint). */
export function nowMs(): number {
  return Date.now();
}

/** Whether a market's close time has passed. */
export function isClosed(closesAt: Date | string): boolean {
  return new Date(closesAt).getTime() <= Date.now();
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
