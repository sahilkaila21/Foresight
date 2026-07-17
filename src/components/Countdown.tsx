"use client";

import { useEffect, useState } from "react";

/**
 * Live-ticking countdown to kickoff (the market close time). Shows "1d 20h",
 * "3h 12m", or "04:59" in the final hour; switches to a closed state once the
 * time has passed.
 */
export default function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Render nothing distinct until mounted to avoid a hydration mismatch.
  if (now === null) return <span className="text-zinc-400">—</span>;

  const ms = target - now;
  if (ms <= 0) {
    return <span className="font-semibold text-rose-500">Kickoff — betting closed</span>;
  }

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  let text: string;
  if (d > 0) text = `${d}d ${h}h`;
  else if (h > 0) text = `${h}h ${m}m`;
  else text = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  return (
    <span>
      Kicks off in <span className="font-semibold text-zinc-700 tabular-nums dark:text-zinc-200">{text}</span>
    </span>
  );
}
