"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewMarketPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        description,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to create market");
      return;
    }
    const market = await res.json();
    router.push(`/markets/${market.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Create a market</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Question</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will [event] happen by [date]?"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            required
            minLength={10}
            maxLength={200}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Ask a question that will be unambiguously YES or NO by the close date.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Resolution criteria <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="How exactly will this resolve? What sources count?"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Closes at</label>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            required
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-zinc-900 py-2 font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Creating…" : "Create market"}
        </button>
      </form>
    </div>
  );
}
