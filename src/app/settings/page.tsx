"use client";

import { useCallback, useEffect, useState } from "react";
import type { CardWithCategories, PointsValuation, UserCppOverride } from "@/lib/types";

export default function SettingsPage() {
  const [cards, setCards] = useState<CardWithCategories[]>([]);
  const [valuations, setValuations] = useState<Record<string, PointsValuation>>({});
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [cardsRes, overridesRes] = await Promise.all([
      fetch("/api/cards"),
      fetch("/api/overrides"),
    ]);
    const cardsData: CardWithCategories[] = cardsRes.ok ? await cardsRes.json() : [];
    const overridesData: UserCppOverride[] = overridesRes.ok ? await overridesRes.json() : [];
    setCards(cardsData);
    setOverrides(
      Object.fromEntries(overridesData.map((o) => [o.reward_program, o.cpp_override])),
    );

    const programs = [...new Set(cardsData.map((c) => c.reward_program))];
    if (programs.length) {
      const valRes = await fetch(`/api/valuations?programs=${encodeURIComponent(programs.join(","))}`);
      if (valRes.ok) {
        const vals: PointsValuation[] = await valRes.json();
        setValuations(Object.fromEntries(vals.map((v) => [v.reward_program, v])));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveOverride(rewardProgram: string) {
    const value = parseFloat(draftValues[rewardProgram]);
    if (Number.isNaN(value)) return;
    await fetch("/api/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewardProgram, cppOverride: value }),
    });
    load();
  }

  async function clearOverride(rewardProgram: string) {
    await fetch("/api/overrides", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewardProgram }),
    });
    load();
  }

  async function resetCap(categoryId: string) {
    await fetch("/api/cards/reset-cap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    load();
  }

  const pointsPrograms = [
    ...new Set(
      cards.filter((c) => c.reward_type !== "cash_back").map((c) => c.reward_program),
    ),
  ];

  const cappedCategories = cards.flatMap((c) =>
    c.card_categories
      .filter((cat) => cat.cap_amount_cents)
      .map((cat) => ({ card: c, cat })),
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-slate-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium">Custom CPP overrides</h2>
        <p className="mb-4 text-sm text-slate-400">
          Override the community cents-per-point consensus for a reward program with your own
          valuation.
        </p>
        {pointsPrograms.length === 0 && (
          <p className="text-sm text-slate-500">No points/miles programs yet.</p>
        )}
        <div className="space-y-3">
          {pointsPrograms.map((program) => {
            const communityCpp = valuations[program]?.cpp_community;
            const current = overrides[program];
            return (
              <div
                key={program}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{program}</p>
                  <p className="text-xs text-slate-500">
                    Community: {communityCpp ? `${communityCpp}¢/pt` : "no data yet"}
                    {current !== undefined && ` · Override: ${current}¢/pt`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="¢/pt"
                    defaultValue={current}
                    onChange={(e) =>
                      setDraftValues((prev) => ({ ...prev, [program]: e.target.value }))
                    }
                    className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => saveOverride(program)}
                    className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Save
                  </button>
                  {current !== undefined && (
                    <button
                      onClick={() => clearOverride(program)}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Spending caps</h2>
        <p className="mb-4 text-sm text-slate-400">Manually reset a category's tracked spend.</p>
        {cappedCategories.length === 0 && (
          <p className="text-sm text-slate-500">No capped categories yet.</p>
        )}
        <div className="space-y-2">
          {cappedCategories.map(({ card, cat }) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm"
            >
              <span>
                {card.name} · {cat.category} — ${(cat.cap_spent_cents / 100).toFixed(0)} / $
                {((cat.cap_amount_cents ?? 0) / 100).toFixed(0)} ({cat.cap_period})
              </span>
              <button
                onClick={() => resetCap(cat.id)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Reset
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
