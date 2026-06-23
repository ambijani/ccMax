import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { researchCardPromos } from "@/lib/ai/promoResearch";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await request.json();
  if (!cardId) return NextResponse.json({ error: "cardId is required" }, { status: 400 });

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("*")
    .eq("id", cardId)
    .single();
  if (cardError || !card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  let result;
  try {
    result = await researchCardPromos(card.name, card.issuer, card.network);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Promo research failed" },
      { status: 502 },
    );
  }

  await supabase.from("card_promos").delete().eq("card_id", cardId);

  if (result.promos.length === 0) {
    return NextResponse.json({ promos: [] });
  }

  const { data, error } = await supabase
    .from("card_promos")
    .insert(
      result.promos.map((p) => ({
        card_id: cardId,
        title: p.title,
        description: p.description,
        merchant_keywords: p.merchant_keywords,
        value_cents: p.value_cents,
        value_percent: p.value_percent,
        terms: p.terms,
        source_text: p.source_text,
        source_url: p.source_url,
        expires_at: p.expires_at,
      })),
    )
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promos: data });
}
