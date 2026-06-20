"use client";

import { useState } from "react";
import type { CardIngestionResult } from "@/lib/ai/cardIngestion";

export default function AddCardFlow({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CardIngestionResult | null>(null);

  async function research() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cards/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ingestion failed");
      setDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setOpen(false);
      setDraft(null);
      setCardName("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        + Add card
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      {!draft && (
        <>
          <p className="mb-3 text-sm text-slate-400">
            Enter the card name and Claude will research its official benefits.
          </p>
          <div className="flex gap-2">
            <input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g. Chase Sapphire Reserve"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={research}
              disabled={loading || !cardName}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Researching..." : "Research"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {draft && (
        <div>
          <h3 className="text-lg font-semibold">{draft.name}</h3>
          <p className="mb-3 text-sm text-slate-400">
            {draft.issuer} · {draft.network} · {draft.reward_program} · base {draft.base_earn_rate}×
          </p>
          {draft.terms_url && (
            <a
              href={draft.terms_url}
              target="_blank"
              rel="noreferrer"
              className="mb-3 inline-block text-xs text-indigo-400 hover:underline"
            >
              Official terms page →
            </a>
          )}
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Review categories before saving
          </p>
          <ul className="space-y-2">
            {draft.categories.map((c, i) => (
              <li key={i} className="rounded-lg bg-slate-950 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.category}</span>
                  <span>{c.earn_rate}×</span>
                </div>
                {c.cap_amount_cents && (
                  <p className="mt-1 text-xs text-slate-500">
                    Cap: ${(c.cap_amount_cents / 100).toFixed(0)} / {c.cap_period}
                  </p>
                )}
                <p className="mt-1 text-xs italic text-slate-400">&ldquo;{c.source_text}&rdquo;</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <button
              onClick={confirmSave}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Confirm & save"}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
