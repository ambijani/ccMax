"use client";

import { useEffect, useState } from "react";
import AddCardFlow from "@/components/AddCardFlow";
import type { CardWithCategories, PointsValuation, RankedCardResult } from "@/lib/types";

interface RecommendResponse {
  classification: {
    category: string;
    confidence: "high" | "medium" | "low";
    ambiguous: boolean;
    alternative_categories: string[];
    reasoning: string;
  };
  ranked: RankedCardResult[];
  valuations: Record<string, PointsValuation>;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function rewardUnit(rewardType: "cash_back" | "points" | "miles") {
  if (rewardType === "cash_back") return "cash back";
  if (rewardType === "miles") return "miles";
  return "points";
}

export default function Home() {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [showRunnerUps, setShowRunnerUps] = useState(false);
  const [overrideCategory, setOverrideCategory] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);
  const [logging, setLogging] = useState(false);
  const [cards, setCards] = useState<CardWithCategories[] | null>(null);

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCards)
      .catch(() => setCards([]));
  }, []);

  async function lookup(category?: string) {
    setLoading(true);
    setError(null);
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantName: merchant, amountCents, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setResult(data);
      setShowRunnerUps(false);
      setLogged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function logPurchase() {
    if (!result?.ranked[0]) return;
    setLogging(true);
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantName: merchant,
          category: overrideCategory ?? result.classification.category,
          amountCents,
          cardId: result.ranked[0].card.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to log purchase");
      setLogged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLogging(false);
    }
  }

  const top = result?.ranked[0];
  const runnerUps = result?.ranked.slice(1) ?? [];
  const topValuation = top ? result?.valuations[top.card.reward_program] : undefined;

  if (cards === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-slate-400">Loading...</p>
      </main>
    );
  }

  if (cards.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-1 text-2xl font-semibold">Welcome!</h1>
        <p className="mb-6 text-sm text-slate-400">
          Add your first credit card to start getting recommendations.
        </p>
        <AddCardFlow onSaved={() => fetch("/api/cards").then((r) => r.json()).then(setCards)} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">What should I use?</h1>
      <p className="mb-6 text-sm text-slate-400">
        Enter what you&apos;re buying (item or merchant) and the amount to get a sourced
        recommendation.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOverrideCategory(null);
          lookup();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Item or merchant (e.g. Costco, plane ticket, groceries)"
          required
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          type="number"
          step="0.01"
          min="0"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none sm:w-32"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Find my card"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {result?.classification.ambiguous && (
        <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-200">
          <p className="mb-2">
            Not sure whether this is <strong>{result.classification.category}</strong> or
            another category: {result.classification.reasoning}
          </p>
          <div className="flex gap-2">
            {[result.classification.category, ...result.classification.alternative_categories].map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setOverrideCategory(cat);
                    lookup(cat);
                  }}
                  className="rounded-md border border-amber-700 px-2 py-1 text-xs hover:bg-amber-900"
                >
                  Use {cat}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {top && (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-indigo-400">
                {overrideCategory ?? result?.classification.category} ·{" "}
                {top.earn_rate}× {rewardUnit(top.card.reward_type)}
              </p>
              <h2 className="text-xl font-semibold">{top.card.name}</h2>
              <p className="text-sm text-slate-400">{top.card.issuer}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-400">
                {formatCents(top.dollar_value_cents)}
              </p>
              {top.card.reward_type !== "cash_back" && (
                <p className="text-xs text-slate-500">
                  {Math.round(top.points_earned).toLocaleString()} {rewardUnit(top.card.reward_type)}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={logPurchase}
            disabled={logging || logged}
            className="mt-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {logged ? "Logged ✓" : logging ? "Logging..." : "I used this card — log it"}
          </button>

          {top.matched_category?.cap_amount_cents && top.cap_percent_used !== null && top.cap_percent_used > 50 && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>
                  {top.matched_category.category} cap ({top.matched_category.cap_period})
                </span>
                <span>{Math.min(top.cap_percent_used, 100).toFixed(0)}% used</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full ${top.cap_status === "warning" ? "bg-amber-500" : "bg-indigo-500"}`}
                  style={{ width: `${Math.min(top.cap_percent_used, 100)}%` }}
                />
              </div>
              {top.cap_status === "warning" && (
                <p className="mt-1 text-xs text-amber-400">
                  Approaching the cap for this category — consider a backup card soon.
                </p>
              )}
            </div>
          )}

          {top.matched_category && (
            <div className="mt-5 rounded-lg bg-slate-950 p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Why this card
              </p>
              <p className="text-sm italic text-slate-300">
                &ldquo;{top.matched_category.source_text}&rdquo;
              </p>
              {top.matched_category.source_url && (
                <a
                  href={top.matched_category.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-indigo-400 hover:underline"
                >
                  View official terms →
                </a>
              )}
            </div>
          )}

          {topValuation && (
            <div className="mt-3 rounded-lg bg-slate-950 p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Community take
              </p>
              <p className="text-sm text-slate-300">{topValuation.valuation_notes}</p>
              {topValuation.sources?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {topValuation.sources.slice(0, 3).map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      {s.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {runnerUps.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowRunnerUps((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                {showRunnerUps ? "Hide" : "Show"} runner-up cards ({runnerUps.length})
              </button>
              {showRunnerUps && (
                <ul className="mt-2 space-y-2">
                  {runnerUps.map((r) => (
                    <li
                      key={r.card.id}
                      className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm"
                    >
                      <span className={r.excluded ? "text-slate-500" : "text-slate-200"}>
                        {r.card.name} — {r.earn_rate}×
                        {r.excluded && r.exclusion_reason ? ` (${r.exclusion_reason})` : ""}
                      </span>
                      <span className="text-slate-400">{formatCents(r.dollar_value_cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {result && result.ranked.length === 0 && (
        <p className="mt-6 text-sm text-slate-400">
          You don&apos;t have any cards yet — add one on the My Cards page.
        </p>
      )}
    </main>
  );
}
