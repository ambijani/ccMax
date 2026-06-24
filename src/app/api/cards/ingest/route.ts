import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { ingestCard } from "@/lib/ai/cardIngestion";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkRateLimit(supabase, user.id, "cards/ingest", { limit: 10, windowSeconds: 60 });
  if (!allowed) return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });

  const { cardName } = await request.json();
  if (!cardName || typeof cardName !== "string") {
    return NextResponse.json({ error: "cardName is required" }, { status: 400 });
  }

  try {
    const result = await ingestCard(cardName, { signal: request.signal });
    return NextResponse.json(result);
  } catch (err) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 502 },
    );
  }
}
