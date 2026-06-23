"use client";

import { useEffect, useState } from "react";
import AddCardFlow from "@/components/AddCardFlow";
import { formatEarnRate, rewardUnit } from "@/lib/format";
import type { CardPromo, CardWithCategories, PointsValuation, RankedCardResult } from "@/lib/types";

interface MatchedPromo extends CardPromo {
  card?: CardWithCategories;
}

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
  matched_promos: MatchedPromo[];
}

function formatPromoValue(promo: CardPromo) {
  if (promo.value_cents) return `$${(promo.value_cents / 100).toFixed(0)} off`;
  if (promo.value_percent) return `${promo.value_percent}% off`;
  return null;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Home() {
  const [store, setStore] = useState("");
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
  const [showCalc, setShowCalc] = useState(false);
  const [applyingValuation, setApplyingValuation] = useState(false);

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCards)
      .catch(() => setCards([]));
  }, []);

  function merchantName() {
    return store ? `${store} - ${merchant}` : merchant;
  }

  async function lookup(category?: string) {
    setLoading(true);
    setError(null);
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantName: merchantName(), amountCents, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setResult(data);
      setShowRunnerUps(false);
      setShowCalc(false);
      setLogged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function applyValuation(rewardProgram: string, cppOverride: number) {
    setApplyingValuation(true);
    try {
      await fetch("/api/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardProgram, cppOverride }),
      });
      await lookup(overrideCategory ?? undefined);
    } finally {
      setApplyingValuation(false);
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
          merchantName: merchantName(),
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
  const bestAlt = runnerUps.find((r) => !r.excluded) ?? null;
  const bestCashBack =
    result?.ranked.find((r) => !r.excluded && r.card.reward_type === "cash_back") ?? null;
  const bestPoints =
    result?.ranked.find((r) => !r.excluded && r.card.reward_type !== "cash_back") ?? null;
  const topValuation = top ? result?.valuations[top.card.reward_program] : undefined;
  const topCategory = overrideCategory ?? result?.classification.category ?? "";

  if (cards === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="font-mono text-sm text-ink-500">Loading...</p>
      </main>
    );
  }

  if (cards.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="mb-1 font-mono text-xs tracking-[0.2em] text-foil uppercase">First entry</p>
        <h1 className="mb-1 font-display text-2xl font-medium text-ink-100">Welcome to the ledger</h1>
        <p className="mb-6 text-sm text-ink-500">
          Add your first credit card to start getting recommendations.
        </p>
        <AddCardFlow onSaved={() => fetch("/api/cards").then((r) => r.json()).then(setCards)} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="mb-1 font-mono text-xs tracking-[0.2em] text-foil uppercase">New entry</p>
      <h1 className="mb-1 font-display text-2xl font-medium text-ink-100">What should I use?</h1>
      <p className="mb-6 text-sm text-ink-500">
        Enter what you&apos;re buying and the amount — we&apos;ll pull the right card.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOverrideCategory(null);
          lookup();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="sm:w-56">
            <label className="mb-1 block font-mono text-xs tracking-wide text-ink-500 uppercase">
              Where (optional)
            </label>
            <input
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="Costco, Amazon, Target..."
              className="field-line w-full text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block font-mono text-xs tracking-wide text-ink-500 uppercase">
              Item or what you&apos;re buying
            </label>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Ninja Crispi, plane ticket, groceries..."
              required
              className="field-line w-full text-sm"
            />
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="sm:w-32">
            <label className="mb-1 block font-mono text-xs tracking-wide text-ink-500 uppercase">
              Amount
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              required
              className="field-line tabular w-full text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-foil px-4 py-2 text-sm font-medium text-ledger-950 hover:bg-foil-dim disabled:opacity-50"
          >
            {loading ? "Thinking..." : "Find my card"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-4 border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">
          {error}
        </p>
      )}

      {result?.classification.ambiguous && (
        <div className="mt-4 border border-ledger-700 bg-ledger-900 px-4 py-3 text-sm">
          <p className="mb-2 text-ink-300">
            Not sure whether this is <strong className="text-ink-100">{result.classification.category}</strong> or
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
                  className="border border-foil/40 px-2 py-1 font-mono text-xs text-foil hover:bg-foil/10"
                >
                  Use {cat}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {result && result.matched_promos.length > 0 && (
        <div className="mt-4 space-y-2">
          {result.matched_promos.map((p) => (
            <div key={p.id} className="border-l-2 border-signal bg-ledger-900 px-4 py-3 text-sm">
              <p className="font-medium text-signal">
                {p.card?.name ?? "A card"} · {p.title}
                {formatPromoValue(p) && (
                  <span className="ml-2 font-mono text-ink-100">{formatPromoValue(p)}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-ink-500">{p.description}</p>
              {p.terms && <p className="mt-1 text-xs text-ink-500">Terms: {p.terms}</p>}
              {p.source_url && (
                <a
                  href={p.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block font-mono text-xs text-signal hover:underline"
                >
                  Source →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {top && (
        <div className="mt-6">
          {/* Card silhouette — the recommended physical card */}
          <div className="mx-auto flex aspect-[1.6/1] w-full max-w-md flex-col justify-between rounded-[10px] border border-ledger-700 bg-gradient-to-br from-ledger-900 to-ledger-850 p-6 shadow-[0_0_50px_-15px_rgba(199,162,78,0.3)]">
            <div className="flex items-start justify-between font-mono text-xs tracking-[0.15em] text-ink-500 uppercase">
              <span>{top.card.issuer}</span>
              <span>{top.card.network}</span>
            </div>

            <div>
              {top.card.reward_type === "cash_back" ? (
                <p className="font-mono text-4xl font-semibold tracking-tight text-foil">
                  {formatCents(top.dollar_value_cents)}
                </p>
              ) : (
                <>
                  <p className="font-mono text-4xl font-semibold tracking-tight text-foil">
                    {Math.round(top.points_earned).toLocaleString()}
                  </p>
                  <p className="mt-0.5 font-mono text-sm text-ink-500">
                    {rewardUnit(top.card.reward_type)} · ≈ {formatCents(top.dollar_value_cents)}
                  </p>
                </>
              )}
            </div>

            <div>
              <div className="-mx-6 mb-3 h-2.5 bg-ledger-950/70" />
              <div className="flex items-end justify-between">
                <p className="font-display text-sm font-medium tracking-wide text-ink-100 uppercase">
                  {top.card.name}
                </p>
                <p className="font-mono text-xs text-ink-500">
                  {overrideCategory ?? result?.classification.category} ·{" "}
                  {formatEarnRate(top.card.reward_type, top.earn_rate)}
                </p>
              </div>
            </div>
          </div>

          {/* Why this card — purchase-specific decision summary */}
          <div className="mt-5 border-l-2 border-foil/40 bg-ledger-900 px-4 py-3 text-sm">
            <p className="mb-1.5 font-mono text-xs tracking-wide text-ink-500 uppercase">Why this card</p>
            <div className="space-y-1.5 text-ink-300">
              <p>
                {top.matched_category ? (
                  <>
                    <strong className="text-ink-100">{topCategory}</strong> is a bonus category on{" "}
                    {top.card.name} — {formatEarnRate(top.card.reward_type, top.matched_category.earn_rate)}{" "}
                    instead of its {formatEarnRate(top.card.reward_type, top.card.base_earn_rate)} base rate.
                  </>
                ) : (
                  <>
                    None of your cards have a bonus for{" "}
                    <strong className="text-ink-100">{topCategory}</strong>, so this uses {top.card.name}
                    &apos;s base rate of {formatEarnRate(top.card.reward_type, top.card.base_earn_rate)}.
                  </>
                )}
              </p>
              {bestAlt && (
                <p>
                  {top.dollar_value_cents > bestAlt.dollar_value_cents ? (
                    <>
                      Worth {formatCents(top.dollar_value_cents)} — beats the next best option,{" "}
                      {bestAlt.card.name}, at {formatCents(bestAlt.dollar_value_cents)}.
                    </>
                  ) : (
                    <>
                      Ties with {bestAlt.card.name} at {formatCents(bestAlt.dollar_value_cents)}
                      {top.matched_category && !bestAlt.matched_category
                        ? ` — picked first since it has an explicit bonus for this purchase and ${bestAlt.card.name} doesn't.`
                        : "."}
                    </>
                  )}
                </p>
              )}
              {top.card.reward_type !== "cash_back" && (
                <p>
                  That assumes the <strong className="text-ink-100">guaranteed</strong> redemption value (
                  {top.cpp_used?.toFixed(2)}¢/{rewardUnit(top.card.reward_type).replace(/s$/, "")}) — open
                  the calculation below to compare against an optimized-redemption estimate.
                </p>
              )}
              {top.matched_category?.source_text && (
                <p className="border-l-2 border-ledger-700 pl-3 text-xs italic text-ink-500">
                  &ldquo;{top.matched_category.source_text}&rdquo;
                  {top.matched_category.source_url && (
                    <>
                      {" "}
                      <a
                        href={top.matched_category.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono not-italic text-foil hover:underline"
                      >
                        Source →
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Cash back vs. points — secondary comparison, since the two aren't
              directly comparable (points carry redemption risk/effort that
              cash back doesn't), and the top pick may not match what someone
              who doesn't want points would choose. */}
          {bestCashBack && bestPoints && bestCashBack.card.id !== bestPoints.card.id && (
            <div className="mt-5 border border-ledger-800">
              <p className="border-b border-ledger-800 bg-ledger-900 px-4 py-2 font-mono text-xs tracking-wide text-ink-500 uppercase">
                Cash back vs. points
              </p>
              <div className="grid grid-cols-2 divide-x divide-ledger-800">
                <div className="px-4 py-3">
                  <div className="mb-1 flex items-center gap-2 font-mono text-xs tracking-wide text-ink-500 uppercase">
                    <span>Most cash back</span>
                    {top.card.id === bestCashBack.card.id && (
                      <span className="border border-foil/40 px-1.5 py-0.5 text-foil">Picked</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-ink-100">{bestCashBack.card.name}</p>
                  <p className="font-mono text-lg text-ink-100">{formatCents(bestCashBack.dollar_value_cents)}</p>
                </div>
                <div className="px-4 py-3">
                  <div className="mb-1 flex items-center gap-2 font-mono text-xs tracking-wide text-ink-500 uppercase">
                    <span>Most points/miles</span>
                    {top.card.id === bestPoints.card.id && (
                      <span className="border border-foil/40 px-1.5 py-0.5 text-foil">Picked</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-ink-100">{bestPoints.card.name}</p>
                  <p className="font-mono text-lg text-ink-100">
                    {Math.round(bestPoints.points_earned).toLocaleString()} {rewardUnit(bestPoints.card.reward_type)}
                  </p>
                  <p className="font-mono text-xs text-ink-500">
                    ≈ {formatCents(bestPoints.dollar_value_cents)} guaranteed
                  </p>
                </div>
              </div>
              <p className="border-t border-ledger-800 px-4 py-2 text-xs text-ink-500">
                Points value assumes the guaranteed redemption rate — worth more if you transfer to a
                partner you&apos;d actually use, less if you just want cash in hand.
              </p>
            </div>
          )}

          {/* Ledger entries — supporting detail */}
          <div className="mt-5 divide-y divide-ledger-800 border-y border-ledger-800">
            <div className="flex items-center justify-between py-3">
              <button
                onClick={() => setShowCalc((v) => !v)}
                className="font-mono text-xs text-ink-500 hover:text-ink-100"
              >
                {showCalc ? "Hide" : "Show"} calculation
              </button>
              <button
                onClick={logPurchase}
                disabled={logging || logged}
                className="bg-foil px-3 py-1.5 font-mono text-xs font-medium text-ledger-950 hover:bg-foil-dim disabled:opacity-50"
              >
                {logged ? "Logged ✓" : logging ? "Logging..." : "I used this card — log it"}
              </button>
            </div>

            {showCalc && (
              <div className="border-l-2 border-foil/40 py-3 pl-3 font-mono text-xs text-ink-500">
                {top.card.reward_type === "cash_back" ? (
                  <p>
                    ${(parseFloat(amount) || 0).toFixed(2)} spent × {top.earn_rate}% cash back ={" "}
                    <span className="text-ink-100">{formatCents(top.dollar_value_cents)}</span>
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p>
                      ${(parseFloat(amount) || 0).toFixed(2)} spent × {top.earn_rate}×{" "}
                      {rewardUnit(top.card.reward_type)} ={" "}
                      <span className="text-ink-100">
                        {Math.round(top.points_earned).toLocaleString()} {rewardUnit(top.card.reward_type)}
                      </span>
                    </p>
                    <p>
                      {Math.round(top.points_earned).toLocaleString()} {rewardUnit(top.card.reward_type)} ×{" "}
                      {top.cpp_used?.toFixed(2)}¢/{rewardUnit(top.card.reward_type).replace(/s$/, "")} (
                      {top.cpp_source === "override"
                        ? "your custom valuation"
                        : top.cpp_source === "conservative"
                          ? "guaranteed/conservative valuation"
                          : "default — no valuation researched yet"}
                      ) = <span className="text-ink-100">{formatCents(top.dollar_value_cents)}</span>{" "}
                      estimated value
                    </p>
                    {top.cpp_source === "default" && (
                      <p className="text-alert">
                        No valuation researched yet for {top.card.reward_program} — using a flat
                        1¢/{rewardUnit(top.card.reward_type).replace(/s$/, "")} default.
                      </p>
                    )}
                    {topValuation && top.conservative_dollar_value_cents !== null && top.community_dollar_value_cents !== null && (
                      <div className="mt-2 border-t border-ledger-800 pt-2">
                        <p className="mb-1.5 normal-case text-ink-300">
                          That number depends on how you redeem. Pick which to use for{" "}
                          {top.card.reward_program}:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => applyValuation(top.card.reward_program, topValuation.cpp_conservative ?? 1)}
                            disabled={applyingValuation}
                            className={`border px-2 py-1 normal-case disabled:opacity-50 ${
                              top.cpp_source === "conservative" ||
                              (top.cpp_source === "override" && top.cpp_used === topValuation.cpp_conservative)
                                ? "border-signal text-signal"
                                : "border-ledger-700 text-ink-300 hover:bg-ledger-800"
                            }`}
                          >
                            Guaranteed: {formatCents(top.conservative_dollar_value_cents)} ({topValuation.cpp_conservative}¢)
                          </button>
                          <button
                            onClick={() => applyValuation(top.card.reward_program, topValuation.cpp_community ?? 1)}
                            disabled={applyingValuation}
                            className={`border px-2 py-1 normal-case disabled:opacity-50 ${
                              top.cpp_source === "override" && top.cpp_used === topValuation.cpp_community
                                ? "border-signal text-signal"
                                : "border-ledger-700 text-ink-300 hover:bg-ledger-800"
                            }`}
                          >
                            If I optimize redemptions: {formatCents(top.community_dollar_value_cents)} (
                            {topValuation.cpp_community}¢)
                          </button>
                        </div>
                        <p className="mt-2 normal-case text-ink-500">{topValuation.valuation_notes}</p>
                        {topValuation.sources?.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-3">
                            {topValuation.sources.slice(0, 3).map((s) => (
                              <a
                                key={s.url}
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-foil hover:underline"
                              >
                                {s.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {top.matched_category?.cap_amount_cents && top.cap_percent_used !== null && top.cap_percent_used > 50 && (
              <div className="py-3">
                <div className="mb-1.5 flex justify-between font-mono text-xs text-ink-500">
                  <span>
                    {top.matched_category.category} cap ({top.matched_category.cap_period})
                  </span>
                  <span>{Math.min(top.cap_percent_used, 100).toFixed(0)}% used</span>
                </div>
                <div className="h-1 w-full bg-ledger-800">
                  <div
                    className={`h-full ${top.cap_status === "warning" ? "bg-alert" : "bg-foil"}`}
                    style={{ width: `${Math.min(top.cap_percent_used, 100)}%` }}
                  />
                </div>
                {top.cap_status === "warning" && (
                  <p className="mt-1.5 font-mono text-xs text-alert">
                    Approaching the cap for this category — consider a backup card soon.
                  </p>
                )}
              </div>
            )}

            {runnerUps.length > 0 && (
              <div className="py-3">
                <button
                  onClick={() => setShowRunnerUps((v) => !v)}
                  className="font-mono text-xs text-ink-500 hover:text-ink-100"
                >
                  {showRunnerUps ? "Hide" : "Show"} runner-up cards ({runnerUps.length})
                </button>
                {showRunnerUps && (
                  <ul className="mt-2 divide-y divide-ledger-800">
                    {runnerUps.map((r) => (
                      <li key={r.card.id} className="flex items-center justify-between py-2 text-sm">
                        <span className={r.excluded ? "text-ink-500" : "text-ink-300"}>
                          {r.card.name} — {formatEarnRate(r.card.reward_type, r.earn_rate)}
                          {r.excluded && r.exclusion_reason ? ` (${r.exclusion_reason})` : ""}
                        </span>
                        <span className="font-mono text-xs text-ink-500">
                          {r.card.reward_type === "cash_back"
                            ? formatCents(r.dollar_value_cents)
                            : `${Math.round(r.points_earned).toLocaleString()} ${rewardUnit(r.card.reward_type)} (≈ ${formatCents(r.dollar_value_cents)})`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {result && result.ranked.length === 0 && (
        <p className="mt-6 text-sm text-ink-500">
          You don&apos;t have any cards yet — add one on the My Cards page.
        </p>
      )}
    </main>
  );
}
