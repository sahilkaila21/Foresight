/**
 * Probability history as a step line (probability is constant between trades).
 * Pure server-rendered SVG — no chart library, no client JS.
 */

export interface ProbPoint {
  /** epoch ms */
  t: number;
  /** probability of YES, 0..1 */
  p: number;
}

const W = 600;
const H = 180;
const PAD_L = 34;
const PAD_R = 8;
const PAD_Y = 10;

export default function ProbChart({ points }: { points: ProbPoint[] }) {
  if (points.length < 2) return null;

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = Math.max(t1 - t0, 1);
  const x = (t: number) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);
  const y = (p: number) => PAD_Y + (1 - p) * (H - 2 * PAD_Y);

  // Step-after path: horizontal to the next trade's time, then vertical jump
  let d = `M ${x(points[0].t)} ${y(points[0].p)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H ${x(points[i].t)} V ${y(points[i].p)}`;
  }
  const area = `${d} V ${y(0)} H ${x(t0)} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Probability history"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(g)}
            y2={y(g)}
            className={g === 0.5 ? "stroke-zinc-300 dark:stroke-zinc-700" : "stroke-zinc-200 dark:stroke-zinc-800"}
            strokeDasharray={g === 0.5 ? undefined : "3 3"}
          />
          <text
            x={PAD_L - 6}
            y={y(g) + 3}
            textAnchor="end"
            className="fill-zinc-400 font-mono text-[10px]"
          >
            {Math.round(g * 100)}%
          </text>
        </g>
      ))}
      <path d={area} className="fill-indigo-500/10" />
      <path d={d} fill="none" strokeWidth={2} className="stroke-indigo-500" />
      <circle
        cx={x(t1)}
        cy={y(points[points.length - 1].p)}
        r={3.5}
        className="fill-indigo-500"
      />
    </svg>
  );
}
