"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Step {
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    emoji: "⚽",
    title: "Welcome to Foresight",
    body: "Everyone gets ₱1,000 in play tokens to bet on the World Cup. No real money — just bragging rights. Let's see who can actually call the winners.",
  },
  {
    emoji: "🎯",
    title: "Pick a match",
    body: "Open a match — Spain vs Argentina or France vs England. Each team shows a live price in ¢ — that's the crowd's current odds of them winning.",
  },
  {
    emoji: "💸",
    title: "Back your team",
    body: "Buy shares in the team you think wins. Cheaper odds = bigger payout if you're right. Enter an amount and hit Buy — every winning share pays out ₱1.",
  },
  {
    emoji: "📈",
    title: "The odds move with the crowd",
    body: "Every bet shifts the odds — it's consensus-based. When people pile onto a team, its price rises and the other falls. The % is the market's live prediction.",
  },
  {
    emoji: "🏆",
    title: "Win & climb the leaderboard",
    body: "After each match is played, it resolves to the real winner and winning shares pay out. Watch your balance grow and race your friends up the leaderboard.",
  },
];

const SEEN_KEY = "foresight_seen_howto_v1";

export default function HowToUse() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-open once for first-time visitors. Runs after mount because
  // localStorage isn't available during server rendering.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" && step < STEPS.length - 1) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  function openGuide() {
    setStep(0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <>
      <button
        onClick={openGuide}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
      >
        <span aria-hidden>💡</span>
        <span>How to use?</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="How to use Foresight"
        >
          <button
            className="absolute inset-0 cursor-default bg-zinc-900/50 backdrop-blur-sm"
            onClick={close}
            aria-label="Close"
            tabIndex={-1}
          />

          <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
            <button
              onClick={close}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-lg text-white backdrop-blur transition hover:bg-white/40"
              aria-label="Close guide"
            >
              ✕
            </button>

            {/* Illustration area */}
            <div className="flex h-40 items-center justify-center rounded-t-3xl bg-gradient-to-br from-indigo-500 to-violet-600">
              <span className="text-7xl drop-shadow-lg">{current.emoji}</span>
            </div>

            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="mt-1 text-xl font-bold">{current.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {current.body}
              </p>

              {/* Progress dots */}
              <div className="mt-5 flex justify-center gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    aria-label={`Go to step ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      i === step ? "w-6 bg-indigo-600" : "w-2 bg-zinc-300 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                {step > 0 && (
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => (isLast ? close() : setStep((s) => s + 1))}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-500"
                >
                  {isLast ? "Start betting 🎉" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
