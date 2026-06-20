import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CardIngestionResult } from "@/lib/ai/cardIngestion";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("cards")
    .select("*, card_categories(*)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as CardIngestionResult;

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .insert({
      user_id: user.id,
      name: body.name,
      issuer: body.issuer,
      network: body.network,
      reward_type: body.reward_type,
      reward_program: body.reward_program,
      base_earn_rate: body.base_earn_rate,
      terms_url: body.terms_url,
    })
    .select()
    .single();

  if (cardError) return NextResponse.json({ error: cardError.message }, { status: 500 });

  if (body.categories?.length) {
    const { error: catError } = await supabase.from("card_categories").insert(
      body.categories.map((c) => ({
        card_id: card.id,
        category: c.category,
        earn_rate: c.earn_rate,
        cap_amount_cents: c.cap_amount_cents,
        cap_period: c.cap_period,
        source_text: c.source_text,
        source_url: c.source_url,
      })),
    );
    if (catError) return NextResponse.json({ error: catError.message }, { status: 500 });
  }

  return NextResponse.json(card);
}
