"use client";

import { useState, type ReactNode } from "react";
import CategoricalTradePanel, { type PanelOutcome } from "./CategoricalTradePanel";
import MultiProbChart, { type Series } from "./MultiProbChart";

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

  return (
    <>
      {series.length > 0 && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <MultiProbChart series={series} selected={selected} />
        </div>
      )}
      {positionBlock}
      <CategoricalTradePanel {...panel} selected={selected} onSelectChange={setSelected} />
    </>
  );
}
