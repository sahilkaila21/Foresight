"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";

type Kind = "BINARY" | "CATEGORICAL";

export default function NewMarketPage() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("BINARY");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Other");
  const [closesAt, setClosesAt] = useState("");
  const [outcomes, setOutcomes] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setOutcome(i: number, value: string) {
    setOutcomes((prev) => prev.map((o, j) => (j === i ? value : o)));
  }
  function addOutcome() {
    setOutcomes((prev) => (prev.length < 10 ? [...prev, ""] : prev));
  }
  function removeOutcome(i: number) {
    setOutcomes((prev) => (prev.length > 2 ? prev.filter((_, j) => j !== i) : prev));
  }

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
        kind,
        category,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        outcomes: kind === "CATEGORICAL" ? outcomes.map((o) => o.trim()).filter(Boolean) : undefined,
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
          <label className="mb-1 block text-sm font-medium">Market type</label>
          <div className="flex gap-2">
            {(
              [
                ["BINARY", "Yes / No", "A single true-or-false question"],
                ["CATEGORICAL", "Multiple choice", "Pick one of several outcomes"],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`flex-1 rounded-md border px-3 py-2 text-left transition ${
                  kind === value
                    ? "border-zinc-900 dark:border-zinc-100"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-zinc-500">{hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Question</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              kind === "BINARY" ? "Will [event] happen by [date]?" : "Who / which will [outcome]?"
            }
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            required
            minLength={10}
            maxLength={200}
          />
          <p className="mt-1 text-xs text-zinc-500">
            {kind === "BINARY"
              ? "Ask a question that will be unambiguously YES or NO by the close date."
              : "Ask a question with exactly one winning outcome by the close date."}
          </p>
        </div>

        {kind === "CATEGORICAL" && (
          <div>
            <label className="mb-1 block text-sm font-medium">Outcomes</label>
            <div className="space-y-2">
              {outcomes.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={o}
                    onChange={(e) => setOutcome(i, e.target.value)}
                    placeholder={`Outcome ${i + 1}`}
                    maxLength={60}
                    className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                  />
                  {outcomes.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOutcome(i)}
                      className="rounded-md border border-zinc-300 px-3 text-zinc-500 hover:text-rose-600 dark:border-zinc-700"
                      aria-label="Remove outcome"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {outcomes.length < 10 && (
              <button
                type="button"
                onClick={addOutcome}
                className="mt-2 text-sm text-zinc-600 underline dark:text-zinc-400"
              >
                + Add outcome
              </button>
            )}
          </div>
        )}

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
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Closes at</label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              required
            />
          </div>
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
