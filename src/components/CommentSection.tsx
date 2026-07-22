"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface CommentItem {
  id: string;
  username: string;
  body: string;
  createdAt: string;
  reactions: Reaction[];
}

// Emoji offered in the composer picker and as reactions.
const EMOJIS = ["👍", "🔥", "😂", "🤔", "🚀", "💯"];

export default function CommentSection({
  marketId,
  initial,
  signedIn,
}: {
  marketId: string;
  initial: CommentItem[];
  signedIn: boolean;
}) {
  const [comments, setComments] = useState<CommentItem[]>(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/markets/${marketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to post comment");
      return;
    }
    const created = await res.json();
    setComments((prev) => [{ ...created, reactions: [] }, ...prev]);
    setBody("");
  }

  async function react(commentId: string, emoji: string) {
    if (!signedIn) return;
    const res = await fetch(`/api/comments/${commentId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, reactions: data.reactions } : c))
    );
  }

  return (
    <div>
      <h2 className="mb-3 font-semibold">
        Comments{comments.length > 0 && ` (${comments.length})`}
      </h2>

      {signedIn ? (
        <form onSubmit={submit} className="mb-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Share your reasoning…"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
          <div className="mt-2 flex items-center justify-between">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmoji((s) => !s)}
                className="rounded-md px-2 py-1.5 text-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
                aria-label="Insert emoji"
              >
                😊
              </button>
              {showEmoji && (
                <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-md dark:border-zinc-800 dark:bg-zinc-950">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setBody((b) => b + e);
                        setShowEmoji(false);
                      }}
                      className="rounded p-1 text-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy ? "Posting…" : "Post comment"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mb-4 text-sm text-zinc-500">
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          to join the discussion.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-zinc-500">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                <Link
                  href={`/users/${c.username}`}
                  className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                >
                  @{c.username}
                </Link>
                <span>·</span>
                <span>{formatDateTime(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                {c.reactions.map((r) => (
                  <button
                    key={r.emoji}
                    type="button"
                    onClick={() => react(c.id, r.emoji)}
                    disabled={!signedIn}
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                      r.mine
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                        : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    } disabled:cursor-default disabled:opacity-60`}
                  >
                    <span>{r.emoji}</span>
                    <span className="font-mono">{r.count}</span>
                  </button>
                ))}
                {signedIn && (
                  <ReactAdder onPick={(e) => react(c.id, e)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The "+" affordance that opens the emoji list to add a new reaction. */
function ReactAdder({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 items-center rounded-full border border-dashed border-zinc-300 px-2 text-xs text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:hover:text-zinc-300"
        aria-label="Add reaction"
      >
        +
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-md dark:border-zinc-800 dark:bg-zinc-950">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="rounded p-1 text-base hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
