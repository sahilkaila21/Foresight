/**
 * Multi-outcome probability history: one step line per outcome over time.
 * Pure server-rendered SVG. Series share a common time axis; each outcome's
 * probability is constant between trades, so lines step at each trade.
 *
 * To keep many outcomes readable, only one outcome is drawn bold in its color
 * and on top; every other option is faded to a thin grey line so the overall
 * picture stays legible instead of a tangle of equal-weight lines. The
 * highlighted outcome follows the `selected` prop (the player chosen in the
 * trade panel); with no selection it defaults to the current leader.
 */

export interface Series {
  label: string;
  points: { t: number; p: number }[];
}

// Fixed palette (inline stroke keeps Tailwind from purging dynamic classes).
// Exported so other outcome-list UI (e.g. the trade panel) uses matching colors.
export const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

const W = 600;
const H = 200;
const PAD_L = 34;
const PAD_R = 8;
const PAD_Y = 10;

export default function MultiProbChart({
  series,
  selected,
}: {
  series: Series[];
  selected?: number;
}) {
  const flat = series.flatMap((s) => s.points.map((p) => p.t));
  if (flat.length < 2) return null;
  const t0 = Math.min(...flat);
  const t1 = Math.max(...flat);
  const span = Math.max(t1 - t0, 1);
  const x = (t: number) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);
  const y = (p: number) => PAD_Y + (1 - p) * (H - 2 * PAD_Y);

  const stepPath = (points: { t: number; p: number }[]) => {
    let d = `M ${x(points[0].t)} ${y(points[0].p)}`;
    for (let i = 1; i < points.length; i++) d += ` H ${x(points[i].t)} V ${y(points[i].p)}`;
    return d;
  };

  const lastP = (s: Series) => s.points[s.points.length - 1].p;
  // Highlight the selected outcome; if none given, fall back to the current
  // leader (highest latest probability). Drawn bold, in color, on top.
  let leader = 0;
  series.forEach((s, i) => {
    if (lastP(s) > lastP(series[leader])) leader = i;
  });
  const highlight =
    selected != null && selected >= 0 && selected < series.length ? selected : leader;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Probability history">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(g)}
              y2={y(g)}
              className="stroke-zinc-200 dark:stroke-zinc-800"
              strokeDasharray="3 3"
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
        {/* Non-highlighted: thin, faded grey, drawn underneath. */}
        {series.map((s, i) =>
          i === highlight ? null : (
            <path
              key={s.label}
              d={stepPath(s.points)}
              fill="none"
              strokeWidth={1.25}
              strokeLinejoin="round"
              className="stroke-zinc-300 dark:stroke-zinc-700"
            />
          ),
        )}
        {/* Highlighted: bold, in its color, on top. */}
        <path
          d={stepPath(series[highlight].points)}
          fill="none"
          strokeWidth={2.5}
          strokeLinejoin="round"
          stroke={COLORS[highlight % COLORS.length]}
        />
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s, i) => {
          const last = s.points[s.points.length - 1];
          const isLeader = i === highlight;
          return (
            <span key={s.label} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-sm ${isLeader ? "" : "bg-zinc-300 dark:bg-zinc-700"}`}
                style={isLeader ? { backgroundColor: COLORS[i % COLORS.length] } : undefined}
              />
              <span
                className={
                  isLeader
                    ? "font-semibold text-zinc-800 dark:text-zinc-100"
                    : "text-zinc-400 dark:text-zinc-500"
                }
              >
                {s.label}
              </span>
              <span
                className={`font-mono ${isLeader ? "text-zinc-600 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"}`}
              >
                {Math.round(last.p * 100)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
