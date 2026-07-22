"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Share popover for a market: copy the direct link or an iframe embed snippet
 * (like Polymarket's link + `</>` buttons).
 */
export default function ShareButton({ marketId }: { marketId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/markets/${marketId}`;
  const embed = `<iframe src="${origin}/embed/${marketId}" width="440" height="220" frameborder="0" title="Foresight market"></iframe>`;

  async function copy(what: "link" | "embed", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Share"
        title="Share"
        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <label className="mb-1 block text-xs font-medium text-zinc-500">Link</label>
          <div className="mb-3 flex gap-2">
            <input
              readOnly
              value={link}
              className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={() => copy("link", link)}
              className="shrink-0 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {copied === "link" ? "✓" : "Copy"}
            </button>
          </div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Embed</label>
          <textarea
            readOnly
            value={embed}
            rows={3}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-[11px] leading-tight dark:border-zinc-800 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={() => copy("embed", embed)}
            className="mt-2 w-full rounded-md border border-zinc-200 py-1 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            {copied === "embed" ? "Copied!" : "Copy embed code"}
          </button>
        </div>
      )}
    </div>
  );
}
