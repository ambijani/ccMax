import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { cardId, category, earnRate, capAmountCents, capPeriod, sourceText, sourceUrl } = body;
  if (!cardId || !category || typeof earnRate !== "number") {
    return NextResponse.json(
      { error: "cardId, category, and earnRate are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("card_categories")
    .insert({
      card_id: cardId,
      category,
      earn_rate: earnRate,
      cap_amount_cents: capAmountCents ?? null,
      cap_period: capPeriod ?? null,
      source_text: sourceText ?? null,
      source_url: sourceUrl ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, category, earnRate, capAmountCents, capPeriod, sourceText, sourceUrl } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (category !== undefined) update.category = category;
  if (earnRate !== undefined) update.earn_rate = earnRate;
  if (capAmountCents !== undefined) update.cap_amount_cents = capAmountCents;
  if (capPeriod !== undefined) update.cap_period = capPeriod;
  if (sourceText !== undefined) update.source_text = sourceText;
  if (sourceUrl !== undefined) update.source_url = sourceUrl;

  const { data, error } = await supabase
    .from("card_categories")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("card_categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
