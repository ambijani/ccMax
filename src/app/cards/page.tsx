"use client";

import { useCallback, useEffect, useState } from "react";
import AddCardFlow from "@/components/AddCardFlow";
import type { CardWithCategories } from "@/lib/types";

function capPercent(cap: { cap_amount_cents: number | null; cap_spent_cents: number }) {
  if (!cap.cap_amount_cents) return null;
  return (cap.cap_spent_cents / cap.cap_amount_cents) * 100;
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
              {card.card_categories.map((c) => {
                const pct = capPercent(c);
                return (
                  <li key={c.id} className="rounded-lg bg-slate-950 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{c.category}</span>
                      <span>{c.earn_rate}×</span>
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
                          ${(c.cap_spent_cents / 100).toFixed(0)} / $
                          {((c.cap_amount_cents ?? 0) / 100).toFixed(0)} ({c.cap_period})
                          {pct >= 100 && " — cap hit"}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
