"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";

export interface CommentItem {
  id: string;
  username: string;
  body: string;
  createdAt: string;
}

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
    const created: CommentItem = await res.json();
    setComments((prev) => [created, ...prev]);
    setBody("");
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
          <div className="mt-2 flex justify-end">
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
                <span className="font-medium text-zinc-700 dark:text-zinc-300">@{c.username}</span>
                <span>·</span>
                <span>{formatDateTime(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
