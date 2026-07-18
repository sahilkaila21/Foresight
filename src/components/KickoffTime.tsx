"use client";

import { useEffect, useState } from "react";

/**
 * Renders kickoff time + date in the viewer's own timezone. Must run client-side:
 * formatting a Date server-side uses the server process's timezone, not the
 * visitor's, so the same kickoff would show a different hour to every visitor
 * depending on where the server happens to run.
 */
export default function KickoffTime({ to }: { to: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <>
        <div className="text-lg font-bold sm:text-xl">—</div>
        <div className="mt-0.5 text-xs text-zinc-500">—</div>
      </>
    );
  }

  const date = new Date(to);
  return (
    <>
      <div className="text-lg font-bold sm:text-xl">
        {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </div>
      <div className="mt-0.5 text-xs text-zinc-500">
        {date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
      </div>
    </>
  );
}
