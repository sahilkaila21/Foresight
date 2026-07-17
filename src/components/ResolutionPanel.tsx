"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { RESOLUTION_BOND, type Phase } from "@/lib/resolution";

export interface OutcomeOption {
  key: string;
  label: string;
}

interface Props {
  marketId: string;
  phase: Phase;
  options: OutcomeOption[];
  signedIn: boolean;
  isAdmin: boolean;
  isProposer: boolean;
  proposedLabel: string | null;
  proposedBy: string | null;
  disputedBy: string | null;
  challengeUntil: string | null; // ISO
}

export default function ResolutionPanel(props: Props) {
  const { marketId, phase, options, signedIn, isAdmin, isProposer } = props;
  const router = useRouter();
  const [selected, setSelected] = useState(options[0]?.key ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (phase === "OPEN" || phase === "RESOLVED") return null;

  async function act(action: string, path: string, body?: object) {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/markets/${marketId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Action failed");
      return;
    }
    router.refresh();
  }

  const loginPrompt = (verb: string) => (
    <p className="text-sm text-zinc-500">
      <Link href="/login" className="underline">
        Log in
      </Link>{" "}
      to {verb}.
    </p>
  );

  const OutcomePicker = (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => setSelected(o.key)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
            selected === o.key
              ? "border-zinc-900 dark:border-zinc-100"
              : "border-zinc-200 text-zinc-500 dark:border-zinc-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Resolution</h2>
        <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          {phase.replace(/_/g, " ").toLowerCase()}
        </span>
      </div>

      {/* Status summary */}
      {props.proposedLabel && (
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          Proposed <strong>{props.proposedLabel}</strong>
          {props.proposedBy && (
            <>
              {" "}
              by{" "}
              <Link href={`/users/${props.proposedBy}`} className="underline">
                @{props.proposedBy}
              </Link>
            </>
          )}
          {props.disputedBy && (
            <>
              {" · "}disputed by{" "}
              <Link href={`/users/${props.disputedBy}`} className="underline">
                @{props.disputedBy}
              </Link>
            </>
          )}
        </p>
      )}

      {/* AWAITING_PROPOSAL: anyone may propose */}
      {phase === "AWAITING_PROPOSAL" &&
        (signedIn ? (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              This market has closed. Propose the winning outcome — this stakes a ₱{RESOLUTION_BOND}{" "}
              bond, returned if your proposal stands.
            </p>
            {OutcomePicker}
            <button
              onClick={() => act("propose", "propose", { outcome: selected })}
              disabled={busy !== null || !selected}
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy === "propose" ? "Proposing…" : "Propose outcome"}
            </button>
          </div>
        ) : (
          <div className="mt-3">{loginPrompt("propose an outcome")}</div>
        ))}

      {/* IN_CHALLENGE: dispute available */}
      {phase === "IN_CHALLENGE" && (
        <div className="mt-3 space-y-2">
          {props.challengeUntil && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Challenge window ends {formatDateTime(props.challengeUntil)}.
            </p>
          )}
          {!signedIn ? (
            loginPrompt("dispute this proposal")
          ) : isProposer ? (
            <p className="text-xs text-zinc-500">You proposed this outcome.</p>
          ) : (
            <button
              onClick={() => act("dispute", "dispute")}
              disabled={busy !== null}
              className="rounded-md border border-rose-500 px-4 py-1.5 text-sm font-semibold text-rose-700 disabled:opacity-40 dark:text-rose-400"
            >
              {busy === "dispute" ? "Disputing…" : `Dispute (₱${RESOLUTION_BOND} bond)`}
            </button>
          )}
        </div>
      )}

      {/* READY_TO_FINALIZE: anyone may settle */}
      {phase === "READY_TO_FINALIZE" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            The challenge window has closed with no dispute. Anyone can finalize.
          </p>
          {signedIn ? (
            <button
              onClick={() => act("finalize", "finalize")}
              disabled={busy !== null}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === "finalize" ? "Finalizing…" : "Finalize & pay out"}
            </button>
          ) : (
            loginPrompt("finalize this market")
          )}
        </div>
      )}

      {/* DISPUTED: admin adjudicates */}
      {phase === "DISPUTED" && (
        <div className="mt-3">
          {isAdmin ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Adjudicate the dispute — the correct side keeps its bond and wins the other&rsquo;s.
              </p>
              {OutcomePicker}
              <button
                onClick={() => act("admin", "admin-resolve", { outcome: selected })}
                disabled={busy !== null || !selected}
                className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {busy === "admin" ? "Resolving…" : "Resolve dispute"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Awaiting an admin to adjudicate the dispute.
            </p>
          )}
        </div>
      )}

      {/* Admin override for any closed, undisputed phase */}
      {isAdmin && (phase === "IN_CHALLENGE" || phase === "READY_TO_FINALIZE") && (
        <details className="mt-4 border-t border-amber-300/60 pt-3 dark:border-amber-900/60">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Admin override
          </summary>
          <div className="mt-2 space-y-2">
            {OutcomePicker}
            <button
              onClick={() => act("admin", "admin-resolve", { outcome: selected })}
              disabled={busy !== null || !selected}
              className="rounded-md border border-zinc-400 px-4 py-1.5 text-sm font-semibold disabled:opacity-40 dark:border-zinc-600"
            >
              {busy === "admin" ? "Resolving…" : "Resolve now"}
            </button>
          </div>
        </details>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
