import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { classifyMerchant } from "@/lib/ai/classifyMerchant";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkRateLimit(supabase, user.id, "classify", { limit: 30, windowSeconds: 60 });
  if (!allowed) return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });

  const { merchantName } = await request.json();
  if (!merchantName || typeof merchantName !== "string") {
    return NextResponse.json({ error: "merchantName is required" }, { status: 400 });
  }

  try {
    const result = await classifyMerchant(supabase, merchantName);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Classification failed" },
      { status: 502 },
    );
  }
}
