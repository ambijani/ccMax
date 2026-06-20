import { NextResponse } from "next/server";
import { ingestCard } from "@/lib/ai/cardIngestion";

export async function POST(request: Request) {
  const { cardName } = await request.json();
  if (!cardName || typeof cardName !== "string") {
    return NextResponse.json({ error: "cardName is required" }, { status: 400 });
  }

  try {
    const result = await ingestCard(cardName);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 502 },
    );
  }
}
