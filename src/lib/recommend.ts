import type { CardWithCategories, PointsValuation, RankedCardResult } from "@/lib/types";

function findCategoryMatch(card: CardWithCategories, category: string) {
  return (
    card.card_categories.find(
      (c) => c.category.toLowerCase() === category.toLowerCase(),
    ) ?? null
  );
}

export function rankCardsForPurchase(
  cards: CardWithCategories[],
  category: string,
  amountCents: number,
  valuationsByProgram: Record<string, PointsValuation>,
  cppOverridesByProgram: Record<string, number> = {},
): RankedCardResult[] {
  const amountDollars = amountCents / 100;

  const results: RankedCardResult[] = cards.map((card) => {
    const matched = findCategoryMatch(card, category);
    const earnRate = matched?.earn_rate ?? card.base_earn_rate;

    let capStatus: RankedCardResult["cap_status"] = "none";
    let capPercentUsed: number | null = null;
    let excluded = false;
    let exclusionReason: string | null = null;

    if (matched?.cap_amount_cents) {
      capPercentUsed = (matched.cap_spent_cents / matched.cap_amount_cents) * 100;
      if (capPercentUsed >= 100) {
        capStatus = "hit";
        excluded = true;
        exclusionReason = `${matched.category} cap of $${(matched.cap_amount_cents / 100).toFixed(0)} (${matched.cap_period}) already hit — falling back to base rate elsewhere is recommended.`;
      } else if (capPercentUsed > 80) {
        capStatus = "warning";
      } else {
        capStatus = "ok";
      }
    }

    let dollarValueCents: number;
    let pointsEarned: number;
    let cppUsed: number | null = null;
    let cppSource: RankedCardResult["cpp_source"] = null;
    let conservativeDollarValueCents: number | null = null;
    let communityDollarValueCents: number | null = null;

    if (card.reward_type === "cash_back") {
      pointsEarned = 0;
      dollarValueCents = Math.round(amountDollars * earnRate);
    } else {
      pointsEarned = amountDollars * earnRate;
      const valuation = valuationsByProgram[card.reward_program];
      const override = cppOverridesByProgram[card.reward_program];
      const community = valuation?.cpp_community;
      const conservative = valuation?.cpp_conservative;
      cppUsed = override ?? community ?? 1;
      cppSource = override !== undefined ? "override" : community !== undefined ? "community" : "default";
      dollarValueCents = Math.round(pointsEarned * (cppUsed / 100) * 100);
      conservativeDollarValueCents = Math.round(pointsEarned * ((conservative ?? 1) / 100) * 100);
      communityDollarValueCents = Math.round(pointsEarned * ((community ?? 1) / 100) * 100);
    }

    return {
      card,
      matched_category: matched,
      earn_rate: earnRate,
      points_earned: pointsEarned,
      dollar_value_cents: dollarValueCents,
      cpp_used: cppUsed,
      cpp_source: cppSource,
      conservative_dollar_value_cents: conservativeDollarValueCents,
      community_dollar_value_cents: communityDollarValueCents,
      cap_status: capStatus,
      cap_percent_used: capPercentUsed,
      excluded,
      exclusion_reason: exclusionReason,
    };
  });

  return results.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    return b.dollar_value_cents - a.dollar_value_cents;
  });
}
