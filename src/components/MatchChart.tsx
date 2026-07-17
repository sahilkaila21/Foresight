/**
 * Two-team probability history for a match market.
 *
 * For a two-outcome market the teams' probabilities are exact mirror images
 * (pA = 1 − pB), so drawing two lines just braids them into an unreadable
 * tangle. Instead we draw ONE boundary line and fill the area on each side of
 * it: the region below the line is team A, above is team B, each tinted in the
 * team's color and labelled with its current %. Always clean, never crosses.
 */

export interface MatchSeries {
  label: string;
  color: string;
  points: { t: number; p: number }[];
}

const W = 720;
const H = 300;
const PAD_L = 8;
const PAD_R = 120; // room for the end labels
const PAD_Y = 26;

export default function MatchChart({ series }: { series: MatchSeries[] }) {
  if (series.length < 2) return null;
  const [teamA, teamB] = series; // A = below the line, B = above
  const pts = teamA.points;
  if (pts.length < 2) return null;

  const allT = pts.map((p) => p.t);
  const allP = series.flatMap((s) => s.points.map((p) => p.p));
  const t0 = Math.min(...allT);
  const t1 = Math.max(...allT);
  const span = Math.max(t1 - t0, 1);

  // Zoom the y-window to the data, but keep a generous minimum span so small
  // moves near 50% don't get amplified into visual noise.
  const dataLo = Math.min(...allP);
  const dataHi = Math.max(...allP);
  const mid = (dataLo + dataHi) / 2;
  const half = Math.max((dataHi - dataLo) / 2 + 0.1, 0.22);
  const lo = Math.max(0, mid - half);
  const hi = Math.min(1, mid + half);
  const range = Math.max(hi - lo, 0.05);

  const x = (t: number) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);
  const y = (p: number) => PAD_Y + (1 - (p - lo) / range) * (H - 2 * PAD_Y);

  // Step line through team A's probability.
  let lineD = `M ${x(pts[0].t)} ${y(pts[0].p)}`;
  for (let i = 1; i < pts.length; i++) lineD += ` H ${x(pts[i].t)} V ${y(pts[i].p)}`;

  const xFirst = x(pts[0].t);
  const xLast = x(pts[pts.length - 1].t);
  const yBottom = y(lo);
  const yTop = y(hi);
  const belowD = `${lineD} L ${xLast} ${yBottom} L ${xFirst} ${yBottom} Z`;
  const aboveD = `${lineD} L ${xLast} ${yTop} L ${xFirst} ${yTop} Z`;

  const pA = pts[pts.length - 1].p;
  const pB = 1 - pA;
  const clampY = (v: number) => Math.max(PAD_Y + 14, Math.min(H - PAD_Y - 6, v));
  const yLine = y(pA);
  const labelYA = clampY(yLine + 22); // team A label sits below the line
  const labelYB = clampY(yLine - 12); // team B label sits above the line
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + (range * i) / 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Match probability history">
      {ticks.map((g, i) => (
        <g key={i}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(g)}
            y2={y(g)}
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeDasharray="3 4"
          />
          <text x={W - 6} y={y(g) + 4} textAnchor="end" className="fill-zinc-400 font-mono text-[11px]">
            {Math.round(g * 100)}%
          </text>
        </g>
      ))}

      {/* Two-tone fill: team B above the line, team A below. */}
      <path d={aboveD} fill={teamB.color} fillOpacity={0.14} stroke="none" />
      <path d={belowD} fill={teamA.color} fillOpacity={0.14} stroke="none" />

      {/* Boundary line. */}
      <path d={lineD} fill="none" strokeWidth={2.5} strokeLinejoin="round" stroke={teamA.color} />
      <circle cx={xLast} cy={yLine} r={4} fill={teamA.color} />

      {/* End labels — one per team, inside its region. */}
      <g>
        <text x={xLast + 10} y={labelYB - 2} className="text-[12px] font-semibold" fill={teamB.color}>
          {teamB.label}
        </text>
        <text x={xLast + 10} y={labelYB + 14} className="text-[16px] font-bold" fill={teamB.color}>
          {Math.round(pB * 100)}%
        </text>
      </g>
      <g>
        <text x={xLast + 10} y={labelYA - 2} className="text-[12px] font-semibold" fill={teamA.color}>
          {teamA.label}
        </text>
        <text x={xLast + 10} y={labelYA + 14} className="text-[16px] font-bold" fill={teamA.color}>
          {Math.round(pA * 100)}%
        </text>
      </g>
    </svg>
  );
}
