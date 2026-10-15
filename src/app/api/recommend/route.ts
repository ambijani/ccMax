import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { classifyMerchant } from "@/lib/ai/classifyMerchant";
import { rankCardsForPurchase } from "@/lib/recommend";
import { verifyEarnRate } from "@/lib/ai/verifyEarnRate";
import type { CardPromo, CardWithCategories, PointsValuation, UserCppOverride } from "@/lib/types";

function matchesPromo(merchantName: string, promo: CardPromo): boolean {
  if (!promo.merchant_keywords || promo.merchant_keywords.length === 0) return false;
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) return false;
  const merchantLower = merchantName.toLowerCase();
  return promo.merchant_keywords.some(
    (kw) => merchantLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(merchantLower),
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkRateLimit(supabase, user.id, "recommend", { limit: 30, windowSeconds: 60 });
  if (!allowed) return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });

  const { merchantName, amountCents, category: forcedCategory } = await request.json();
  if (!merchantName || !amountCents) {
    return NextResponse.json(
      { error: "merchantName and amountCents are required" },
      { status: 400 },
    );
  }

  let classification;
  try {
    classification = forcedCategory
      ? { category: forcedCategory, confidence: "high" as const, ambiguous: false, alternative_categories: [], reasoning: "User-selected category." }
      : await classifyMerchant(supabase, merchantName);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Classification failed" },
      { status: 502 },
    );
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("*, card_categories(*)")
    .returns<CardWithCategories[]>();
  if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });

  const rewardPrograms = [...new Set((cards ?? []).map((c) => c.reward_program))];
  const { data: valuations } = await supabase
    .from("points_valuations")
    .select("*")
    .in("reward_program", rewardPrograms.length ? rewardPrograms : ["__none__"])
    .returns<PointsValuation[]>();

  const valuationsByProgram = Object.fromEntries(
    (valuations ?? []).map((v) => [v.reward_program, v]),
  );

  const { data: overrides } = await supabase
    .from("user_cpp_overrides")
    .select("*")
    .returns<UserCppOverride[]>();

  const overridesByProgram = Object.fromEntries(
    (overrides ?? []).map((o) => [o.reward_program, o.cpp_override]),
  );

  const cardIds = (cards ?? []).map((c) => c.id);
  const { data: promos } = await supabase
    .from("card_promos")
    .select("*")
    .in("card_id", cardIds.length ? cardIds : ["__none__"])
    .returns<CardPromo[]>();

  const matchedPromos = (promos ?? []).filter((p) => matchesPromo(merchantName, p));

  const promosByCardId: Record<string, CardPromo[]> = {};
  for (const p of matchedPromos) {
    (promosByCardId[p.card_id] ??= []).push(p);
  }

  const ranked = rankCardsForPurchase(
    cards ?? [],
    classification.category,
    amountCents,
    valuationsByProgram,
    overridesByProgram,
    merchantName,
    promosByCardId,
  );

  // Eagerly research only the top card — it's the one always shown to the
  // user. Runner-up cards are verified lazily via /api/verify-runner-ups,
  // only if the user expands that list.
  const researchCandidates = ranked
    .filter((r) => !r.excluded && r.matched_category?.source_text)
    .slice(0, 1);

  const researchResults = await Promise.allSettled(
    researchCandidates.map((r) =>
      verifyEarnRate(
        supabase,
        merchantName,
        r.matched_category!.category,
        r.effective_earn_rate,
        r.card.name,
        r.card.reward_type,
        r.matched_category!.source_text!,
      ).then((verification) => ({ cardId: r.card.id, verification })),
    ),
  );

  // Research is a caveat flag, not a rate override — it doesn't change the computed
  // rate/value or re-rank cards. It just tells the user when the AI's read of the terms
  // disagrees with the structural category match, so they can verify before relying on it.
  const research_notes: Record<string, { note: string; qualifies: boolean }> = {};
  for (const result of researchResults) {
    if (result.status !== "fulfilled") continue;
    const { cardId, verification } = result.value;
    research_notes[cardId] = verification;
  }

  return NextResponse.json({
    classification,
    ranked,
    valuations: valuationsByProgram,
    matched_promos: matchedPromos.map((p) => ({ ...p, card: (cards ?? []).find((c) => c.id === p.card_id) })),
    research_notes,
  });
}
