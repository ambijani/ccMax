"use client";

import { useCallback, useEffect, useState } from "react";
import AddCardFlow from "@/components/AddCardFlow";
import { REWARD_CATEGORIES } from "@/lib/types";
import type { CardCategory, CardWithCategories } from "@/lib/types";

function capPercent(cap: { cap_amount_cents: number | null; cap_spent_cents: number }) {
  if (!cap.cap_amount_cents) return null;
  return (cap.cap_spent_cents / cap.cap_amount_cents) * 100;
}

function CategoryRow({
  cat,
  onSaved,
}: {
  cat: CardCategory;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(cat.category);
  const [earnRate, setEarnRate] = useState(cat.earn_rate);
  const [capDollars, setCapDollars] = useState(
    cat.cap_amount_cents !== null ? String(cat.cap_amount_cents / 100) : "",
  );
  const [capPeriod, setCapPeriod] = useState(cat.cap_period ?? "");
  const [sourceText, setSourceText] = useState(cat.source_text ?? "");
  const [sourceUrl, setSourceUrl] = useState(cat.source_url ?? "");
  const [saving, setSaving] = useState(false);

  const pct = capPercent(cat);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/cards/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cat.id,
          category,
          earnRate,
          capAmountCents: capDollars ? Math.round(parseFloat(capDollars) * 100) : null,
          capPeriod: capPeriod || null,
          sourceText: sourceText || null,
          sourceUrl: sourceUrl || null,
        }),
      });
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${cat.category} bonus category?`)) return;
    await fetch("/api/cards/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id }),
    });
    onSaved();
  }

  if (!editing) {
    return (
      <li className="rounded-lg bg-slate-950 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span>{cat.category}</span>
          <div className="flex items-center gap-2">
            <span>{cat.earn_rate}×</span>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-indigo-400 hover:underline"
            >
              Edit
            </button>
          </div>
        </div>
        {pct !== null && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full ${pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              ${(cat.cap_spent_cents / 100).toFixed(0)} / $
              {((cat.cap_amount_cents ?? 0) / 100).toFixed(0)} ({cat.cap_period})
              {pct >= 100 && " — cap hit"}
            </p>
          </div>
        )}
        {(cat.source_text || cat.source_url) && (
          <div className="mt-2 rounded-md bg-slate-900 p-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Research
            </p>
            {cat.source_text && (
              <p className="mt-1 text-xs italic text-slate-400">&ldquo;{cat.source_text}&rdquo;</p>
            )}
            {cat.source_url && (
              <a
                href={cat.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-indigo-400 hover:underline"
              >
                Source →
              </a>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="rounded-lg bg-slate-950 p-3 text-sm">
      <div className="flex items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
        >
          {REWARD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.1"
          value={earnRate}
          onChange={(e) => setEarnRate(parseFloat(e.target.value) || 0)}
          className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
        />
        <span className="text-xs text-slate-500">×</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          placeholder="Cap $ (optional)"
          value={capDollars}
          onChange={(e) => setCapDollars(e.target.value)}
          className="w-32 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
        />
        <select
          value={capPeriod}
          onChange={(e) => setCapPeriod(e.target.value as "" | "quarterly" | "annual")}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
        >
          <option value="">No cap period</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
      </div>
      <textarea
        value={sourceText}
        onChange={(e) => setSourceText(e.target.value)}
        placeholder="Paste benefit text / source quote..."
        rows={2}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs italic text-slate-300 placeholder:text-slate-500"
      />
      <input
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="Source URL"
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          onClick={remove}
          className="ml-auto rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function AddCategoryRow({ cardId, onSaved }: { cardId: string; onSaved: () => void }) {
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<string>(REWARD_CATEGORIES[0]);
  const [earnRate, setEarnRate] = useState(1);
  const [saving, setSaving] = useState(false);

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="mt-2 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
      >
        + Add category
      </button>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/cards/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, category, earnRate }),
      });
      setAdding(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
      >
        {REWARD_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        type="number"
        step="0.1"
        value={earnRate}
        onChange={(e) => setEarnRate(parseFloat(e.target.value) || 0)}
        className="w-16 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => setAdding(false)}
        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
      >
        Cancel
      </button>
    </div>
  );
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardWithCategories[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/cards");
    if (res.ok) setCards(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Cards</h1>
        <AddCardFlow onSaved={load} />
      </div>

      {loading && <p className="text-sm text-slate-400">Loading...</p>}

      {!loading && cards.length === 0 && (
        <p className="text-sm text-slate-400">No cards yet — add your first one above.</p>
      )}

      <div className="space-y-4">
        {cards.map((card) => (
          <div key={card.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <h2 className="text-lg font-semibold">{card.name}</h2>
                <p className="text-sm text-slate-400">
                  {card.issuer} · {card.reward_program} · base {card.base_earn_rate}×
                </p>
              </div>
              {card.terms_url && (
                <a
                  href={card.terms_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Terms →
                </a>
              )}
            </div>

            <ul className="mt-3 space-y-2">
              {card.card_categories.map((c) => (
                <CategoryRow key={c.id} cat={c} onSaved={load} />
              ))}
            </ul>
            <AddCategoryRow cardId={card.id} onSaved={load} />
          </div>
        ))}
      </div>
    </main>
  );
}
