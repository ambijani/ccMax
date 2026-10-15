import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { findCategoryMatch } from "@/lib/recommend";
import { verifyEarnRate } from "@/lib/ai/verifyEarnRate";
import type { CardWithCategories } from "@/lib/types";

interface RunnerUpCandidate {
  cardId: string;
  effectiveEarnRate: number;
}

// Verifies earn-rate research for runner-up cards (ranks 2-3) lazily, only
// when the user expands "Show runner-up cards" — the top card is already
// verified eagerly by /api/recommend. Source text is re-resolved from the
// authenticated user's own cards (RLS-scoped), never taken from the client,
// so this can't be used to research arbitrary card terms.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkRateLimit(supabase, user.id, "verify-runner-ups", { limit: 30, windowSeconds: 60 });
  if (!allowed) return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });

  const { merchantName, category, candidates } = await request.json();
  if (!merchantName || !category || !Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json(
      { error: "merchantName, category, and candidates are required" },
      { status: 400 },
    );
  }

  const cardIds = (candidates as RunnerUpCandidate[]).map((c) => c.cardId);
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("*, card_categories(*)")
    .in("id", cardIds)
    .returns<CardWithCategories[]>();
  if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });

  const cardsById = Object.fromEntries((cards ?? []).map((c) => [c.id, c]));

  const researchResults = await Promise.allSettled(
    (candidates as RunnerUpCandidate[]).map((candidate) => {
      const card = cardsById[candidate.cardId];
      if (!card) throw new Error(`Card not found: ${candidate.cardId}`);
      const matchedCategory = findCategoryMatch(card, category, merchantName);
      if (!matchedCategory?.source_text) throw new Error("No source text to verify");

      return verifyEarnRate(
        supabase,
        merchantName,
        category,
        candidate.effectiveEarnRate,
        card.name,
        card.reward_type,
        matchedCategory.source_text,
      ).then((verification) => ({ cardId: card.id, verification }));
    }),
  );

  const research_notes: Record<string, { note: string; qualifies: boolean }> = {};
  for (const result of researchResults) {
    if (result.status !== "fulfilled") continue;
    const { cardId, verification } = result.value;
    research_notes[cardId] = verification;
  }

  return NextResponse.json({ research_notes });
}
