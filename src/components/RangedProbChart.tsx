"use client";

import { useState } from "react";
import { clipToRange, type Range } from "@/lib/history";
import ProbChart, { type ProbPoint } from "./ProbChart";
import RangeTabs from "./RangeTabs";

/** Binary probability chart with a 1D/1W/1M/ALL range selector. */
export default function RangedProbChart({ points }: { points: ProbPoint[] }) {
  const [range, setRange] = useState<Range>("ALL");
  const shown = clipToRange(points, range);
  return (
    <div>
      <RangeTabs value={range} onChange={setRange} />
      <ProbChart points={shown} />
    </div>
  );
}
