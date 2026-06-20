import { researchToJson } from "./anthropic";

export interface PromoResearchItem {
  title: string;
  description: string;
  merchant_keywords: string[] | null;
  value_cents: number | null;
  value_percent: number | null;
  terms: string | null;
  source_text: string;
  source_url: string;
  expires_at: string | null;
}

export interface PromoResearchResult {
  promos: PromoResearchItem[];
}

export async function researchCardPromos(
  cardName: string,
  issuer: string,
  network: string,
): Promise<PromoResearchResult> {
  const prompt = `You are researching CURRENT, ACTIVE promotions, card-linked offers, or network-level perks that a holder of "${cardName}" (issuer: ${issuer}, network: ${network}) could be eligible for right now. Use web search.

Check these specific sources directly:
- The issuer's own promotions/offers pages (e.g. capitalone.com, chase.com, americanexpress.com)
- Wallet/network-level promotions this card may be eligible for — especially Paze (the bank-backed digital wallet; search "Paze promotion" + the issuer name, e.g. "Paze Capital One Sephora" or "Paze $10 off $10"), and any Visa/Mastercard/Amex/Discover-wide offers
- Doctor of Credit, Slickdeals, and Reddit (r/churning, r/creditcards) for offers community members have found and confirmed are live
- Card-linked/targeted merchant offer programs (e.g. "Amex Offers", "Chase Offers", "Capital One Offers", "Citi Merchant Offers") — these are often account-specific/rotating, so if you can't find a fixed merchant list, set merchant_keywords to null and say in the description that it rotates and the user should check their account

Include a promo if you found credible evidence it's real (an official page, a dated forum post, or a reputable deals site) — confirming a promotion exists from a search result counts as a real source, you don't need an exact direct quote. Do not invent promos with no basis at all.

If after searching you genuinely find nothing, return an empty array.

Respond with ONLY a fenced \`\`\`json code block containing:
{
  "promos": [
    {
      "title": string,
      "description": string,
      "merchant_keywords": string[] | null,
      "value_cents": number | null,
      "value_percent": number | null,
      "terms": string | null,
      "source_text": string,
      "source_url": string,
      "expires_at": string | null
    }
  ]
}`;

  return researchToJson<PromoResearchResult>(prompt);
}
