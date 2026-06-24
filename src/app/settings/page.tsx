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
    let active = true;
    (async () => {
      const [cardsRes, overridesRes] = await Promise.all([
        fetch("/api/cards"),
        fetch("/api/overrides"),
      ]);
      const cardsData: CardWithCategories[] = cardsRes.ok ? await cardsRes.json() : [];
      const overridesData: UserCppOverride[] = overridesRes.ok ? await overridesRes.json() : [];
      if (!active) return;
      setCards(cardsData);
      setOverrides(
        Object.fromEntries(overridesData.map((o) => [o.reward_program, o.cpp_override])),
      );

      const programs = [...new Set(cardsData.map((c) => c.reward_program))];
      if (programs.length) {
        const valRes = await fetch(`/api/valuations?programs=${encodeURIComponent(programs.join(","))}`);
        if (valRes.ok && active) {
          const vals: PointsValuation[] = await valRes.json();
          setValuations(Object.fromEntries(vals.map((v) => [v.reward_program, v])));
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

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
        <p className="font-mono text-sm text-ink-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-10 px-4 py-10">
      <div>
        <p className="mb-1 font-mono text-xs tracking-[0.2em] text-foil uppercase">Configuration</p>
        <h1 className="font-display text-2xl font-medium text-ink-100">Settings</h1>
      </div>

      <section>
        <h2 className="mb-1 font-display text-lg font-medium text-ink-100">Custom valuations</h2>
        <p className="mb-4 text-sm text-ink-500">
          Override the community cents-per-point consensus for a reward program with your own.
        </p>
        {pointsPrograms.length === 0 && (
          <p className="text-sm text-ink-500">No points/miles programs yet.</p>
        )}
        <div className="divide-y divide-ledger-800 border-y border-ledger-800">
          {pointsPrograms.map((program) => {
            const communityCpp = valuations[program]?.cpp_community;
            const current = overrides[program];
            return (
              <div key={program} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-100">{program}</p>
                  <p className="font-mono text-xs text-ink-500">
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
                    className="field-line tabular w-20 text-sm"
                  />
                  <button
                    onClick={() => saveOverride(program)}
                    className="bg-foil px-2 py-1 font-mono text-xs font-medium text-ledger-950 hover:bg-foil-dim"
                  >
                    Save
                  </button>
                  {current !== undefined && (
                    <button
                      onClick={() => clearOverride(program)}
                      className="border border-ledger-700 px-2 py-1 font-mono text-xs text-ink-300 hover:bg-ledger-800"
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
        <h2 className="mb-1 font-display text-lg font-medium text-ink-100">Spending caps</h2>
        <p className="mb-4 text-sm text-ink-500">
          Caps reset automatically once a quarter/year rolls over. Reset one manually here if needed.
        </p>
        {cappedCategories.length === 0 && (
          <p className="text-sm text-ink-500">No capped categories yet.</p>
        )}
        <div className="divide-y divide-ledger-800 border-y border-ledger-800">
          {cappedCategories.map(({ card, cat }) => {
            const needsUpdate = cat.is_rotating && cat.needs_review;
            return (
              <div key={cat.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink-300">
                    {card.name} · {cat.category}
                    {cat.is_rotating && (
                      <span className="ml-2 border border-foil/40 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-foil uppercase">
                        Rotating
                      </span>
                    )}
                    {" — "}
                    <span className="font-mono">
                      ${(cat.cap_spent_cents / 100).toFixed(0)} / $
                      {((cat.cap_amount_cents ?? 0) / 100).toFixed(0)} ({cat.cap_period})
                    </span>
                  </span>
                  <button
                    onClick={() => resetCap(cat.id)}
                    className="border border-ledger-700 px-2 py-1 font-mono text-xs text-ink-300 hover:bg-ledger-800"
                  >
                    {needsUpdate ? "Dismiss" : "Reset"}
                  </button>
                </div>
                {needsUpdate && (
                  <p className="mt-1 font-mono text-xs text-alert">
                    New quarter started — the cap reset automatically. Update this category on{" "}
                    {card.name} to whatever&apos;s bonused now.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
