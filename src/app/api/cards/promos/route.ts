import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("cardId");

  let query = supabase.from("card_promos").select("*, cards!inner(user_id)");
  if (cardId) query = query.eq("card_id", cardId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId, title, description, merchantKeywords, expiresAt, sourceText, sourceUrl } = await request.json();
  if (!cardId || !title) return NextResponse.json({ error: "cardId and title are required" }, { status: 400 });

  const { data: card } = await supabase.from("cards").select("id").eq("id", cardId).eq("user_id", user.id).single();
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  const { data, error } = await supabase.from("card_promos").insert({
    card_id: cardId,
    title,
    description: description ?? null,
    merchant_keywords: merchantKeywords?.length ? merchantKeywords : null,
    expires_at: expiresAt ?? null,
    source_text: sourceText ?? null,
    source_url: sourceUrl ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("card_promos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
