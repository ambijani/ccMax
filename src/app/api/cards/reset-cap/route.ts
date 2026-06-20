import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { categoryId } = await request.json();
  if (!categoryId) return NextResponse.json({ error: "categoryId is required" }, { status: 400 });

  const { error } = await supabase
    .from("card_categories")
    .update({ cap_spent_cents: 0, cap_period_start: new Date().toISOString() })
    .eq("id", categoryId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
