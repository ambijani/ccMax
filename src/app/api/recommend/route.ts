import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyMerchant } from "@/lib/ai/classifyMerchant";
import { rankCardsForPurchase } from "@/lib/recommend";
import type { CardWithCategories, PointsValuation, UserCppOverride } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { merchantName, amountCents, category: forcedCategory } = await request.json();
  if (!merchantName || !amountCents) {
    return NextResponse.json(
      { error: "merchantName and amountCents are required" },
      { status: 400 },
    );
  }

  const classification = forcedCategory
    ? { category: forcedCategory, confidence: "high" as const, ambiguous: false, alternative_categories: [], reasoning: "User-selected category." }
    : await classifyMerchant(merchantName);

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

  return NextResponse.json({ classification, ranked, valuations: valuationsByProgram });
}
