import { flagUrl, teamMeta } from "@/lib/teams";
import Countdown from "./Countdown";

interface Props {
  teamA: string;
  teamB: string;
  kickoff: Date;
  matchStatus: string; // "SCHEDULED" | "LIVE" | "FINAL"
  homeScore: number | null;
  awayScore: number | null;
  matchMinute: string | null;
}

/**
 * Flags-above-the-chart header for a two-team match. The center shows kickoff +
 * a live countdown before the game, the live score while it's on, and the final
 * score once it's done.
 */
export default function MatchHeader({
  teamA,
  teamB,
  kickoff,
  matchStatus,
  homeScore,
  awayScore,
  matchMinute,
}: Props) {
  const live = matchStatus === "LIVE";
  const final = matchStatus === "FINAL";
  const hasScore = homeScore != null && awayScore != null;

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-4 sm:px-8">
      <TeamBlock name={teamA} align="items-start" />

      <div className="shrink-0 text-center">
        {live && (
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600 dark:bg-rose-950 dark:text-rose-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            LIVE{matchMinute ? ` · ${matchMinute}` : ""}
          </span>
        )}
        {live || final ? (
          <>
            <div className="text-3xl font-extrabold tabular-nums sm:text-4xl">
              {hasScore ? `${homeScore} – ${awayScore}` : "0 – 0"}
            </div>
            <div className="mt-0.5 text-xs font-semibold text-zinc-500">
              {final ? "Full time" : "In play"}
            </div>
          </>
        ) : (
          <>
            <div className="text-lg font-bold sm:text-xl">
              {kickoff.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {kickoff.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              <Countdown to={kickoff.toISOString()} />
            </div>
          </>
        )}
      </div>

      <TeamBlock name={teamB} align="items-end" />
    </div>
  );
}

function TeamBlock({ name, align }: { name: string; align: string }) {
  const { code } = teamMeta(name);
  return (
    <div className={`flex flex-1 flex-col gap-2 ${align}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={flagUrl(code, 160)}
        alt={`${name} flag`}
        width={64}
        height={48}
        className="h-11 w-16 rounded-md object-cover shadow-sm ring-1 ring-black/5"
      />
      <span className="text-base font-semibold sm:text-lg">{name}</span>
    </div>
  );
}
