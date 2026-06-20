"use client";

import { useState, type ReactNode } from "react";
import type { CardIngestionResult, CardIngestionCategory } from "@/lib/ai/cardIngestion";
import { REWARD_CATEGORIES } from "@/lib/types";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-xs text-slate-400 ${className ?? ""}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function emptyCategory(): CardIngestionCategory {
  return {
    category: REWARD_CATEGORIES[0],
    earn_rate: 1,
    cap_amount_cents: null,
    cap_period: null,
    source_text: "",
    source_url: null,
  };
}

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

  function updateDraftField<K extends keyof CardIngestionResult>(
    key: K,
    value: CardIngestionResult[K],
  ) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function updateCategory(index: number, patch: Partial<CardIngestionCategory>) {
    setDraft((d) => {
      if (!d) return d;
      const categories = d.categories.map((c, i) => (i === index ? { ...c, ...patch } : c));
      return { ...d, categories };
    });
  }

  function removeCategory(index: number) {
    setDraft((d) => {
      if (!d) return d;
      return { ...d, categories: d.categories.filter((_, i) => i !== index) };
    });
  }

  function addCategory() {
    setDraft((d) => (d ? { ...d, categories: [...d.categories, emptyCategory()] } : d));
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
            Enter the card name and Claude will research its official benefits. You&apos;ll be
            able to review and edit everything before saving.
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
              onClick={() => setDraft(emptyCardDraft(cardName))}
              disabled={!cardName}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Enter manually
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
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Card details — edit anything Claude got wrong
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Field label="Card name">
              <input
                value={draft.name}
                onChange={(e) => updateDraftField("name", e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Issuer">
              <input
                value={draft.issuer}
                onChange={(e) => updateDraftField("issuer", e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Network">
              <input
                value={draft.network}
                onChange={(e) => updateDraftField("network", e.target.value)}
                placeholder="Visa, Mastercard, Amex..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Reward type">
              <select
                value={draft.reward_type}
                onChange={(e) =>
                  updateDraftField("reward_type", e.target.value as CardIngestionResult["reward_type"])
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
              >
                <option value="cash_back">Cash back</option>
                <option value="points">Points</option>
                <option value="miles">Miles</option>
              </select>
            </Field>
            <Field label="Reward program">
              <input
                value={draft.reward_program}
                onChange={(e) => updateDraftField("reward_program", e.target.value)}
                placeholder='e.g. "Capital One Miles"'
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Base earn rate (× per $1, on non-bonus purchases)">
              <input
                type="number"
                step="0.1"
                value={draft.base_earn_rate}
                onChange={(e) => updateDraftField("base_earn_rate", parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Terms URL" className="col-span-2">
              <input
                value={draft.terms_url ?? ""}
                onChange={(e) => updateDraftField("terms_url", e.target.value || null)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
              />
            </Field>
          </div>

          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Bonus categories — edit, paste your own benefits text, or remove
          </p>
          <ul className="space-y-3">
            {draft.categories.map((c, i) => (
              <li key={i} className="rounded-lg bg-slate-950 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <select
                    value={c.category}
                    onChange={(e) => updateCategory(i, { category: e.target.value })}
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  >
                    {REWARD_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    value={c.earn_rate}
                    onChange={(e) =>
                      updateCategory(i, { earn_rate: parseFloat(e.target.value) || 0 })
                    }
                    className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-slate-500">×</span>
                  <button
                    onClick={() => removeCategory(i)}
                    className="ml-auto rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Cap $ (optional)"
                    value={c.cap_amount_cents !== null ? c.cap_amount_cents / 100 : ""}
                    onChange={(e) =>
                      updateCategory(i, {
                        cap_amount_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null,
                      })
                    }
                    className="w-32 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                  />
                  <select
                    value={c.cap_period ?? ""}
                    onChange={(e) =>
                      updateCategory(i, {
                        cap_period: e.target.value
                          ? (e.target.value as CardIngestionCategory["cap_period"])
                          : null,
                      })
                    }
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                  >
                    <option value="">No cap period</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <textarea
                  value={c.source_text ?? ""}
                  onChange={(e) => updateCategory(i, { source_text: e.target.value })}
                  placeholder="Paste the benefit text from the issuer's terms page, or edit Claude's research..."
                  rows={2}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs italic text-slate-300 placeholder:text-slate-500"
                />
                <input
                  value={c.source_url ?? ""}
                  onChange={(e) => updateCategory(i, { source_url: e.target.value || null })}
                  placeholder="Source URL"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                />
              </li>
            ))}
          </ul>
          <button
            onClick={addCategory}
            className="mt-2 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            + Add category
          </button>

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

function emptyCardDraft(name: string): CardIngestionResult {
  return {
    name,
    issuer: "",
    network: "",
    reward_type: "cash_back",
    reward_program: "",
    base_earn_rate: 1,
    terms_url: null,
    categories: [],
  };
}
