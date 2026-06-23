import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCapPeriodExpired } from "@/lib/capPeriod";
import type { CardIngestionResult } from "@/lib/ai/cardIngestion";
import type { CardCategory, CardWithCategories } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("cards")
    .select("*, card_categories(*)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cards = data as CardWithCategories[];
  const now = new Date();
  const expired: CardCategory[] = cards
    .flatMap((card) => card.card_categories)
    .filter((cat) => cat.cap_period && isCapPeriodExpired(cat.cap_period_start, cat.cap_period, now));

  await Promise.all(
    expired.map((cat) => {
      const periodStart = now.toISOString();
      cat.cap_spent_cents = 0;
      cat.cap_period_start = periodStart;
      if (cat.is_rotating) cat.needs_review = true;
      return supabase
        .from("card_categories")
        .update({
          cap_spent_cents: 0,
          cap_period_start: periodStart,
          ...(cat.is_rotating ? { needs_review: true } : {}),
        })
        .eq("id", cat.id);
    }),
  );

  return NextResponse.json(cards);
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
        is_rotating: c.is_rotating ?? false,
        source_text: c.source_text,
        source_url: c.source_url,
      })),
    );
    if (catError) return NextResponse.json({ error: catError.message }, { status: 500 });
  }

  return NextResponse.json(card);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, name, issuer, network, rewardType, rewardProgram, baseEarnRate, termsUrl } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (issuer !== undefined) update.issuer = issuer;
  if (network !== undefined) update.network = network;
  if (rewardType !== undefined) update.reward_type = rewardType;
  if (rewardProgram !== undefined) update.reward_program = rewardProgram;
  if (baseEarnRate !== undefined) update.base_earn_rate = baseEarnRate;
  if (termsUrl !== undefined) update.terms_url = termsUrl;

  const { data, error } = await supabase
    .from("cards")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
