/**
 * 24h probability change, shown like Polymarket's "▲49%". `delta` is a signed
 * fraction (e.g. +0.12 = up 12 points). Renders nothing for a flat/absent move.
 */
export default function ChangePill({
  delta,
  className = "",
}: {
  delta: number | null;
  className?: string;
}) {
  if (delta == null || Math.abs(delta) < 1e-4) return null;
  const up = delta > 0;
  const pts = Math.round(Math.abs(delta) * 100);
  if (pts === 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold ${
        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      } ${className}`}
      title="Change over the last 24h"
    >
      {up ? "▲" : "▼"}
      {pts}%
    </span>
  );
}
