import type { CardCategory, CardPromo, CardWithCategories, PointsValuation, RankedCardResult } from "@/lib/types";

function findCategoryMatch(card: CardWithCategories, category: string, merchantName: string = "") {
  const categoryLower = category.toLowerCase();
  let rows = card.card_categories.filter((c) => c.category.toLowerCase() === categoryLower);

  // Cards configured before the Travel - Portal / Travel - Direct split still
  // have a plain "Travel" row — treat it as covering both until re-edited.
  if (rows.length === 0 && categoryLower.startsWith("travel - ")) {
    rows = card.card_categories.filter((c) => c.category.toLowerCase() === "travel");
  }

  // Cards configured before the Online Grocery split, or that simply don't
  // distinguish it, still have a plain "Grocery" row — fall back to that.
  if (rows.length === 0 && categoryLower === "online grocery") {
    rows = card.card_categories.filter((c) => c.category.toLowerCase() === "grocery");
  }

  if (rows.length === 0) return null;

  // When a row has purchase_types, it only applies if the merchant name
  // contains one of the keywords. Pick the most-specific match first.
  const merchantLower = merchantName.toLowerCase();
  if (merchantLower) {
    const keywordMatch = rows.find(
      (r) => r.purchase_types?.length && r.purchase_types.some((t) => merchantLower.includes(t.toLowerCase())),
    );
    if (keywordMatch) return keywordMatch;
  }

  // Fall back to a catch-all row (no purchase_types restriction).
  return rows.find((r) => !r.purchase_types?.length) ?? null;
}

function isMerchantExcluded(category: { excluded_merchants: string[] | null }, merchantName: string) {
  if (!category.excluded_merchants?.length) return false;
  const merchantLower = merchantName.toLowerCase();
  return category.excluded_merchants.some((m) => merchantLower.includes(m.toLowerCase()));
}

// Finds a category row that explicitly includes this merchant via included_merchants,
// regardless of whether the transaction category matches. Used for cards that count
// merchants like Uber/Lyft/parking/transit as travel even though we classify them as General.
function findIncludedMerchantMatch(card: CardWithCategories, merchantName: string): CardCategory | null {
  if (!merchantName) return null;
  const merchantLower = merchantName.toLowerCase();
  return (
    card.card_categories.find(
      (c) => c.included_merchants?.length && c.included_merchants.some((m) => merchantLower.includes(m.toLowerCase())),
    ) ?? null
  );
}

export function rankCardsForPurchase(
  cards: CardWithCategories[],
  category: string,
  amountCents: number,
  valuationsByProgram: Record<string, PointsValuation>,
  cppOverridesByProgram: Record<string, number> = {},
  merchantName: string = "",
  promosByCardId: Record<string, CardPromo[]> = {},
): RankedCardResult[] {
  const amountDollars = amountCents / 100;

  const results: RankedCardResult[] = cards.map((card) => {
    const categoryMatch = findCategoryMatch(card, category, merchantName);
    const includedMatch = findIncludedMerchantMatch(card, merchantName);
    // When both match, take the higher earn rate (explicit category bonus beats an
    // included-merchant override only if it actually pays more).
    const candidateMatch =
      categoryMatch && includedMatch
        ? categoryMatch.earn_rate >= includedMatch.earn_rate
          ? categoryMatch
          : includedMatch
        : (categoryMatch ?? includedMatch);
    const merchantExcluded = candidateMatch !== null && isMerchantExcluded(candidateMatch, merchantName);
    const matched = merchantExcluded ? null : candidateMatch;
    const earnRate = matched?.earn_rate ?? card.base_earn_rate;

    // Find the highest-value promo for this card/merchant combo that specifies an earn rate.
    const cardPromos = promosByCardId[card.id] ?? [];
    const bestPromo = cardPromos.reduce<CardPromo | null>((best, p) => {
      if (!p.value_percent) return best;
      if (!best || !best.value_percent || p.value_percent > best.value_percent) return p;
      return best;
    }, null);
    const effectiveEarnRate = bestPromo?.value_percent ? Math.max(earnRate, bestPromo.value_percent) : earnRate;

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
    let portalDollarValueCents: number | null = null;

    if (card.reward_type === "cash_back") {
      pointsEarned = 0;
      dollarValueCents = Math.round(amountDollars * effectiveEarnRate);
    } else {
      pointsEarned = amountDollars * effectiveEarnRate;
      const valuation = valuationsByProgram[card.reward_program];
      const override = cppOverridesByProgram[card.reward_program];
      const community = valuation?.cpp_community;
      const conservative = valuation?.cpp_conservative;
      const portal = valuation?.cpp_portal;
      // Points earned through the issuer's own travel portal usually redeem
      // at a fixed cash-equivalent rate, distinct from transfer-partner
      // valuations — use it as the default whenever this is a portal booking.
      const isPortalBooking = matched?.category.toLowerCase() === "travel - portal";

      cppUsed = override ?? (isPortalBooking ? portal ?? conservative ?? 1 : conservative ?? 1);
      cppSource =
        override !== undefined
          ? "override"
          : isPortalBooking && portal !== undefined && portal !== null
            ? "portal"
            : conservative !== undefined
              ? "conservative"
              : "default";
      dollarValueCents = Math.round(pointsEarned * (cppUsed / 100) * 100);
      conservativeDollarValueCents = Math.round(pointsEarned * ((conservative ?? 1) / 100) * 100);
      communityDollarValueCents = Math.round(pointsEarned * ((community ?? 1) / 100) * 100);
      portalDollarValueCents =
        portal !== undefined && portal !== null
          ? Math.round(pointsEarned * (portal / 100) * 100)
          : null;
    }

    return {
      card,
      matched_category: matched,
      merchant_excluded_category: merchantExcluded ? candidateMatch : null,
      earn_rate: earnRate,
      effective_earn_rate: effectiveEarnRate,
      matched_promo: bestPromo,
      points_earned: pointsEarned,
      dollar_value_cents: dollarValueCents,
      cpp_used: cppUsed,
      cpp_source: cppSource,
      conservative_dollar_value_cents: conservativeDollarValueCents,
      community_dollar_value_cents: communityDollarValueCents,
      portal_dollar_value_cents: portalDollarValueCents,
      cap_status: capStatus,
      cap_percent_used: capPercentUsed,
      excluded,
      exclusion_reason: exclusionReason,
    };
  });

  return results.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    if (a.dollar_value_cents !== b.dollar_value_cents) return b.dollar_value_cents - a.dollar_value_cents;
    // Tie-breaker: prefer a card with an actual matched bonus category over
    // one merely falling back to its generic base rate.
    const aMatched = a.matched_category ? 1 : 0;
    const bMatched = b.matched_category ? 1 : 0;
    return bMatched - aMatched;
  });
}
