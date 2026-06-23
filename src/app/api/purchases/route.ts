import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCapPeriodExpired } from "@/lib/capPeriod";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { merchantName, category, amountCents, cardId } = await request.json();
  if (!merchantName || !category || !amountCents || !cardId) {
    return NextResponse.json(
      { error: "merchantName, category, amountCents and cardId are required" },
      { status: 400 },
    );
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      user_id: user.id,
      merchant_name: merchantName,
      category,
      amount_cents: amountCents,
      card_used_id: cardId,
    })
    .select()
    .single();

  if (purchaseError) return NextResponse.json({ error: purchaseError.message }, { status: 500 });

  const { data: matched, error: matchError } = await supabase
    .from("card_categories")
    .select("*")
    .eq("card_id", cardId)
    .ilike("category", category)
    .maybeSingle();

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  if (matched?.cap_amount_cents) {
    const expired = matched.cap_period
      ? isCapPeriodExpired(matched.cap_period_start, matched.cap_period)
      : false;

    const newSpent = expired ? amountCents : matched.cap_spent_cents + amountCents;

    const { error: updateError } = await supabase
      .from("card_categories")
      .update({
        cap_spent_cents: newSpent,
        ...(expired
          ? {
              cap_period_start: new Date().toISOString(),
              ...(matched.is_rotating ? { needs_review: true } : {}),
            }
          : {}),
      })
      .eq("id", matched.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(purchase);
}
