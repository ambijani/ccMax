"use client";

import { useCallback, useEffect, useState } from "react";
import AddCardFlow from "@/components/AddCardFlow";
import { formatEarnRate } from "@/lib/format";
import { REWARD_CATEGORIES } from "@/lib/types";
import type { CardCategory, CardPromo, CardWithCategories } from "@/lib/types";

function formatPromoValue(promo: CardPromo) {
  if (promo.value_cents) return `$${(promo.value_cents / 100).toFixed(0)} off`;
  if (promo.value_percent) return `${promo.value_percent}% off`;
  return null;
}

function PromoSection({ cardId }: { cardId: string }) {
  const [promos, setPromos] = useState<CardPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/cards/promos?cardId=${cardId}`);
    if (res.ok) setPromos(await res.json());
    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/cards/promos?cardId=${cardId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) {
          setPromos(data);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [cardId]);

  async function research() {
    setResearching(true);
    setError(null);
    try {
      const res = await fetch("/api/cards/promos/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed");
      setPromos(data.promos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setResearching(false);
    }
  }

  async function remove(id: string) {
    await fetch("/api/cards/promos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs tracking-wide text-ink-500 uppercase">
          Active promos &amp; offers
        </p>
        <button
          onClick={research}
          disabled={researching}
          className="font-mono text-xs text-foil hover:underline disabled:opacity-50"
        >
          {researching ? "Searching Reddit/DoC..." : "Check for active promos"}
        </button>
      </div>
      {error && <p className="mt-1 font-mono text-xs text-alert">{error}</p>}
      {!loading && promos.length === 0 && !researching && (
        <p className="mt-1 text-xs text-ink-500">
          None found yet — click &quot;Check for active promos&quot; to search.
        </p>
      )}
      {promos.length > 0 && (
        <ul className="mt-2 divide-y divide-ledger-800">
          {promos.map((p) => (
            <li key={p.id} className="py-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink-100">
                    {p.title}
                    {formatPromoValue(p) && (
                      <span className="ml-2 font-mono text-signal">{formatPromoValue(p)}</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">{p.description}</p>
                  {p.merchant_keywords && p.merchant_keywords.length > 0 && (
                    <p className="mt-1 font-mono text-xs text-ink-500">
                      Eligible at: {p.merchant_keywords.join(", ")}
                    </p>
                  )}
                  {p.terms && <p className="mt-1 text-xs text-ink-500">Terms: {p.terms}</p>}
                  {p.expires_at && (
                    <p className="mt-1 font-mono text-xs text-alert">
                      Expires {new Date(p.expires_at).toLocaleDateString()}
                    </p>
                  )}
                  {p.source_url && (
                    <a
                      href={p.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block font-mono text-xs text-foil hover:underline"
                    >
                      Source →
                    </a>
                  )}
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="shrink-0 border border-ledger-700 px-2 py-1 font-mono text-xs text-ink-500 hover:bg-ledger-800"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function capPercent(cap: { cap_amount_cents: number | null; cap_spent_cents: number }) {
  if (!cap.cap_amount_cents) return null;
  return (cap.cap_spent_cents / cap.cap_amount_cents) * 100;
}

function CategoryRow({
  cat,
  rewardType,
  onSaved,
}: {
  cat: CardCategory;
  rewardType: CardWithCategories["reward_type"];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(cat.category);
  const [earnRate, setEarnRate] = useState(cat.earn_rate);
  const [capDollars, setCapDollars] = useState(
    cat.cap_amount_cents !== null ? String(cat.cap_amount_cents / 100) : "",
  );
  const [capPeriod, setCapPeriod] = useState(cat.cap_period ?? "");
  const [isRotating, setIsRotating] = useState(cat.is_rotating);
  const [sourceText, setSourceText] = useState(cat.source_text ?? "");
  const [sourceUrl, setSourceUrl] = useState(cat.source_url ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const pct = capPercent(cat);
  const needsQuarterlyUpdate = cat.is_rotating && cat.needs_review;

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
          isRotating,
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

  async function acknowledgeReview() {
    setResetting(true);
    try {
      await fetch("/api/cards/reset-cap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: cat.id }),
      });
      onSaved();
    } finally {
      setResetting(false);
    }
  }

  if (!editing) {
    return (
      <li className="py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-ink-100">
            {cat.category}
            {cat.is_rotating && (
              <span className="border border-foil/40 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-foil uppercase">
                Rotating
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-ink-300">{formatEarnRate(rewardType, cat.earn_rate)}</span>
            <button
              onClick={() => setEditing(true)}
              className="font-mono text-xs text-foil hover:underline"
            >
              Edit
            </button>
          </div>
        </div>
        {needsQuarterlyUpdate && (
          <div className="mt-2 border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert">
            <p>
              New quarter started — the cap was reset automatically, but make sure to update this
              category to whatever&apos;s bonused now. Hit Edit above to change it, then dismiss.
            </p>
            <button
              onClick={acknowledgeReview}
              disabled={resetting}
              className="mt-1.5 border border-alert/40 px-2 py-1 font-mono text-[11px] uppercase hover:bg-alert/10 disabled:opacity-50"
            >
              {resetting ? "Dismissing..." : "Dismiss — I've updated it"}
            </button>
          </div>
        )}
        {pct !== null && (
          <div className="mt-2">
            <div className="h-1 w-full bg-ledger-800">
              <div
                className={`h-full ${pct >= 100 ? "bg-alert" : pct > 80 ? "bg-alert/70" : "bg-foil"}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-xs text-ink-500">
              ${(cat.cap_spent_cents / 100).toFixed(0)} / $
              {((cat.cap_amount_cents ?? 0) / 100).toFixed(0)} ({cat.cap_period})
              {pct >= 100 && " — cap hit"}
            </p>
          </div>
        )}
        {(cat.source_text || cat.source_url) && (
          <div className="mt-2 border-l-2 border-ledger-700 pl-3">
            <p className="font-mono text-xs tracking-wide text-ink-500 uppercase">Research</p>
            {cat.source_text && (
              <p className="mt-1 text-xs text-ink-500 italic">&ldquo;{cat.source_text}&rdquo;</p>
            )}
            {cat.source_url && (
              <a
                href={cat.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-mono text-xs text-foil hover:underline"
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
    <li className="py-3 text-sm">
      <div className="flex items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-ledger-700 bg-ledger-900 px-2 py-1 text-sm text-ink-100"
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
          className="field-line tabular w-20"
        />
        <span className="font-mono text-xs text-ink-500">×</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          placeholder="Cap $ (optional)"
          value={capDollars}
          onChange={(e) => setCapDollars(e.target.value)}
          className="field-line tabular w-32 text-xs"
        />
        <select
          value={capPeriod}
          onChange={(e) => setCapPeriod(e.target.value as "" | "quarterly" | "annual")}
          className="border border-ledger-700 bg-ledger-900 px-2 py-1 text-xs text-ink-100"
        >
          <option value="">No cap period</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
        <label className="flex items-center gap-1.5 font-mono text-xs text-ink-500">
          <input
            type="checkbox"
            checked={isRotating}
            onChange={(e) => setIsRotating(e.target.checked)}
          />
          Rotating (changes each quarter)
        </label>
      </div>
      <textarea
        value={sourceText}
        onChange={(e) => setSourceText(e.target.value)}
        placeholder="Paste benefit text / source quote..."
        rows={2}
        className="field-line mt-2 w-full text-xs text-ink-300 italic placeholder:text-ink-500"
      />
      <input
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="Source URL"
        className="field-line mt-1 w-full text-xs"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="bg-signal px-3 py-1 font-mono text-xs font-medium text-ledger-950 hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="border border-ledger-700 px-3 py-1 font-mono text-xs text-ink-300 hover:bg-ledger-800"
        >
          Cancel
        </button>
        <button
          onClick={remove}
          className="ml-auto border border-ledger-700 px-3 py-1 font-mono text-xs text-ink-500 hover:bg-ledger-800"
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
  const [isRotating, setIsRotating] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!adding) {
    return (
      <div className="py-3">
        <button
          onClick={() => setAdding(true)}
          className="font-mono text-xs text-ink-500 hover:text-foil"
        >
          + Add category
        </button>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/cards/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          category,
          earnRate,
          capPeriod: isRotating ? "quarterly" : null,
          isRotating,
        }),
      });
      setAdding(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 py-3">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="border border-ledger-700 bg-ledger-900 px-2 py-1 text-xs text-ink-100"
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
        className="field-line tabular w-16 text-xs"
      />
      <label className="flex items-center gap-1.5 font-mono text-xs text-ink-500">
        <input
          type="checkbox"
          checked={isRotating}
          onChange={(e) => setIsRotating(e.target.checked)}
        />
        Rotating
      </label>
      <button
        onClick={save}
        disabled={saving}
        className="bg-signal px-2 py-1 font-mono text-xs text-ledger-950 hover:opacity-90 disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => setAdding(false)}
        className="border border-ledger-700 px-2 py-1 font-mono text-xs text-ink-300 hover:bg-ledger-800"
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
    let active = true;
    fetch("/api/cards")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) {
          setCards(data);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 font-mono text-xs tracking-[0.2em] text-foil uppercase">The wallet</p>
          <h1 className="font-display text-2xl font-medium text-ink-100">My Cards</h1>
        </div>
        <AddCardFlow onSaved={load} />
      </div>

      {loading && <p className="font-mono text-sm text-ink-500">Loading...</p>}

      {!loading && cards.length === 0 && (
        <p className="text-sm text-ink-500">No cards yet — add your first one above.</p>
      )}

      <div className="space-y-8">
        {cards.map((card) => (
          <div key={card.id}>
            {/* Card silhouette banner */}
            <div className="flex items-center justify-between rounded-[10px] border border-ledger-700 bg-gradient-to-br from-ledger-900 to-ledger-850 px-5 py-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs tracking-[0.15em] text-ink-500 uppercase">
                  {card.issuer && <span>{card.issuer}</span>}
                  {card.issuer && card.network && <span className="text-ledger-700">·</span>}
                  {card.network && <span>{card.network}</span>}
                </div>
                <p className="mt-1 font-display text-base font-medium text-ink-100">{card.name}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-foil">
                  base {formatEarnRate(card.reward_type, card.base_earn_rate)}
                </p>
                {card.terms_url && (
                  <a
                    href={card.terms_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-ink-500 hover:text-foil"
                  >
                    Terms →
                  </a>
                )}
              </div>
            </div>

            {/* Ledger entries */}
            <div className="divide-y divide-ledger-800 border-x border-b border-ledger-800 px-4">
              <ul className="divide-y divide-ledger-800">
                {card.card_categories.map((c) => (
                  <CategoryRow key={c.id} cat={c} rewardType={card.reward_type} onSaved={load} />
                ))}
              </ul>
              <AddCategoryRow cardId={card.id} onSaved={load} />
              <PromoSection cardId={card.id} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
