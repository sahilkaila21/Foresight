"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  marketId: string;
  teamA: string;
  teamB: string;
  homeScore: number | null;
  awayScore: number | null;
  matchStatus: string;
  matchMinute: string | null;
}

const STATUSES: [string, string][] = [
  ["SCHEDULED", "Scheduled"],
  ["LIVE", "Live"],
  ["FINAL", "Full time"],
];

/**
 * Admin-only panel to post the live score/status of a match as it's played.
 * Only rendered for admins on match markets.
 */
export default function LiveScoreControl(props: Props) {
  const router = useRouter();
  const [home, setHome] = useState(String(props.homeScore ?? 0));
  const [away, setAway] = useState(String(props.awayScore ?? 0));
  const [status, setStatus] = useState(props.matchStatus);
  const [minute, setMinute] = useState(props.matchMinute ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/markets/${props.marketId}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeScore: Number(home),
        awayScore: Number(away),
        matchStatus: status,
        matchMinute: minute || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMsg(data?.error ?? "Failed to save");
      return;
    }
    setMsg("Saved ✓");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        🛠️ Admin · Live score
      </h2>
      <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/70">
        Update as the real match progresses — everyone sees it live.
      </p>

      <div className="mt-3 flex items-end gap-2">
        <ScoreInput label={props.teamA} value={home} onChange={setHome} />
        <span className="pb-2 text-lg font-bold text-zinc-400">–</span>
        <ScoreInput label={props.teamB} value={away} onChange={setAway} />
        <label className="flex-1 text-xs text-zinc-600 dark:text-zinc-400">
          Clock
          <input
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            placeholder="63'"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <div className="mt-3 flex gap-1">
        {STATUSES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
              status === key
                ? "bg-amber-600 text-white"
                : "bg-white text-zinc-600 hover:bg-amber-100 dark:bg-zinc-900 dark:text-zinc-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-amber-600 py-2 text-sm font-bold text-white transition hover:bg-amber-500 disabled:opacity-40"
      >
        {busy ? "Saving…" : "Update score"}
      </button>
      {msg && <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-400">{msg}</p>}
    </div>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-center text-xs text-zinc-600 dark:text-zinc-400">
      <span className="block max-w-[4rem] truncate">{label}</span>
      <input
        type="number"
        min="0"
        max="99"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-14 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-center text-lg font-bold dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
