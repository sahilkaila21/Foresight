import { flagUrl, teamMeta } from "@/lib/teams";

/**
 * Flags-above-the-chart header for a two-team match: home flag + name on the
 * left, kickoff time in the middle, away flag + name on the right.
 */
export default function MatchHeader({
  teamA,
  teamB,
  kickoff,
}: {
  teamA: string;
  teamB: string;
  kickoff: Date;
}) {
  const time = kickoff.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = kickoff.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-4 sm:px-8">
      <TeamBlock name={teamA} align="items-start" />
      <div className="shrink-0 text-center">
        <div className="text-lg font-bold sm:text-xl">{time}</div>
        <div className="mt-0.5 text-sm text-zinc-500">{date}</div>
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
