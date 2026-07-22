"use client";

import { useState, type ReactNode } from "react";
import { clipToRange, type Range } from "@/lib/history";
import CategoricalTradePanel, { type PanelOutcome } from "./CategoricalTradePanel";
import MultiProbChart, { type Series } from "./MultiProbChart";
import RangeTabs from "./RangeTabs";

interface Props {
  series: Series[];
  positionBlock: ReactNode; // server-rendered "Your position" block, if any
  marketId: string;
  outcomes: PanelOutcome[];
  b: number;
  resolution: string | null;
  tradable: boolean;
  signedIn: boolean;
  balance: number;
  holdings: Record<string, number>;
}

/**
 * Holds the selected-outcome state shared between the history chart and the
 * trade panel, so highlighting the chart line follows the player the user
 * picks in the panel (they are otherwise separate server-rendered siblings).
 */
export default function CategoricalMarketSection({ series, positionBlock, ...panel }: Props) {
  const [selected, setSelected] = useState(0);
  const [range, setRange] = useState<Range>("ALL");
  const shownSeries = series.map((s) => ({ ...s, points: clipToRange(s.points, range) }));

  return (
    <>
      {series.length > 0 && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <RangeTabs value={range} onChange={setRange} />
          <MultiProbChart series={shownSeries} selected={selected} />
        </div>
      )}
      {positionBlock}
      <CategoricalTradePanel {...panel} selected={selected} onSelectChange={setSelected} />
    </>
  );
}
