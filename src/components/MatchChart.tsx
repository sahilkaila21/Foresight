/**
 * Two-team probability history for a match market. Server-rendered SVG: one
 * step line per team in the team's color, an auto-scaled right-hand % axis, and
 * a team name + big % label at the end of each line (Polymarket-style).
 */

export interface MatchSeries {
  label: string;
  color: string;
  points: { t: number; p: number }[];
}

const W = 720;
const H = 300;
const PAD_L = 8;
const PAD_R = 118; // room for end labels + axis ticks
const PAD_Y = 26;

export default function MatchChart({ series }: { series: MatchSeries[] }) {
  const allT = series.flatMap((s) => s.points.map((p) => p.t));
  const allP = series.flatMap((s) => s.points.map((p) => p.p));
  if (allT.length < 2) return null;

  const t0 = Math.min(...allT);
  const t1 = Math.max(...allT);
  const span = Math.max(t1 - t0, 1);

  // Auto-scale the y-axis to the data with padding, so near-flat lines still
  // read clearly (like the reference design's 35–65% window).
  const pad = 0.08;
  const lo = Math.max(0, Math.min(...allP) - pad);
  const hi = Math.min(1, Math.max(...allP) + pad);
  const range = Math.max(hi - lo, 0.05);

  const x = (t: number) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);
  const y = (p: number) => PAD_Y + (1 - (p - lo) / range) * (H - 2 * PAD_Y);

  const stepPath = (points: { t: number; p: number }[]) => {
    let d = `M ${x(points[0].t)} ${y(points[0].p)}`;
    for (let i = 1; i < points.length; i++) d += ` H ${x(points[i].t)} V ${y(points[i].p)}`;
    return d;
  };

  // 4 evenly spaced gridlines across the visible range.
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + (range * i) / 4);
  const xEnd = W - PAD_R;

  // End labels, nudged apart if two lines finish close together.
  const ends = series
    .map((s) => ({ s, last: s.points[s.points.length - 1] }))
    .sort((a, b) => a.last.p - b.last.p);
  const labelYs: number[] = [];
  for (const e of ends) {
    let ly = y(e.last.p);
    for (const used of labelYs) if (Math.abs(used - ly) < 34) ly = used - 34;
    labelYs.push(ly);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Match probability history">
      {ticks.map((g, i) => (
        <g key={i}>
          <line
            x1={PAD_L}
            x2={xEnd}
            y1={y(g)}
            y2={y(g)}
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeDasharray="3 4"
          />
          <text
            x={W - 6}
            y={y(g) + 4}
            textAnchor="end"
            className="fill-zinc-400 font-mono text-[11px]"
          >
            {Math.round(g * 100)}%
          </text>
        </g>
      ))}

      {series.map((s) => (
        <path
          key={s.label}
          d={stepPath(s.points)}
          fill="none"
          strokeWidth={2.5}
          strokeLinejoin="round"
          stroke={s.color}
        />
      ))}

      {ends.map(({ s, last }, i) => (
        <g key={s.label}>
          <circle cx={x(last.t)} cy={y(last.p)} r={4} fill={s.color} />
          <text x={xEnd + 10} y={labelYs[i] - 2} className="text-[12px] font-semibold" fill={s.color}>
            {s.label}
          </text>
          <text x={xEnd + 10} y={labelYs[i] + 15} className="text-[17px] font-bold" fill={s.color}>
            {Math.round(last.p * 100)}%
          </text>
        </g>
      ))}
    </svg>
  );
}
