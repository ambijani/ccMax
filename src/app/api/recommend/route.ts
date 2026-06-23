import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { classifyMerchant } from "@/lib/ai/classifyMerchant";
import { rankCardsForPurchase } from "@/lib/recommend";
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
      : await classifyMerchant(merchantName);
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

  const ranked = rankCardsForPurchase(
    cards ?? [],
    classification.category,
    amountCents,
    valuationsByProgram,
    overridesByProgram,
  );

  const cardIds = (cards ?? []).map((c) => c.id);
  const { data: promos } = await supabase
    .from("card_promos")
    .select("*")
    .in("card_id", cardIds.length ? cardIds : ["__none__"])
    .returns<CardPromo[]>();

  const matchedPromos = (promos ?? [])
    .filter((p) => matchesPromo(merchantName, p))
    .map((p) => ({ ...p, card: (cards ?? []).find((c) => c.id === p.card_id) }));

  return NextResponse.json({
    classification,
    ranked,
    valuations: valuationsByProgram,
    matched_promos: matchedPromos,
  });
}
