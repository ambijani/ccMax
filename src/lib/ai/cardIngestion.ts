import { researchToJson } from "./anthropic";
import { REWARD_CATEGORIES } from "@/lib/types";

export interface CardIngestionCategory {
  category: string;
  earn_rate: number;
  cap_amount_cents: number | null;
  cap_period: "quarterly" | "annual" | null;
  is_rotating: boolean;
  source_text: string | null;
  source_url: string | null;
  excluded_merchants: string[] | null;
  included_merchants: string[] | null;
  purchase_types: string[] | null;
}

export interface CardIngestionResult {
  name: string;
  issuer: string;
  network: string;
  reward_type: "cash_back" | "points" | "miles";
  reward_program: string;
  base_earn_rate: number;
  terms_url: string | null;
  categories: CardIngestionCategory[];
}

export async function ingestCard(
  cardName: string,
  options?: { signal?: AbortSignal },
): Promise<CardIngestionResult> {
  const prompt = `You are researching the official benefits of the credit card "${cardName}" using web search.

Find its official issuer benefits/terms page and extract:
- issuer, card network (Visa/Mastercard/Amex/Discover)
- reward_type: one of cash_back, points, miles
- reward_program name (e.g. "Chase Ultimate Rewards"); if cash back, use the card's own name
- base_earn_rate: the earn rate on purchases that don't match any bonus category
- terms_url: the canonical official benefits page URL
- categories: a list of bonus categories. Each category must use one of these names where applicable: ${REWARD_CATEGORIES.join(", ")}. For each category include earn_rate, any spending cap (cap_amount_cents in whole US cents, cap_period "quarterly" or "annual", or null if uncapped), is_rotating (true if this bonus category is only active for part of the year and changes on a schedule, like Discover it's or Chase Freedom's quarterly 5% categories — false for permanent bonus categories), source_text (the EXACT quoted sentence from the terms page that confirms this rate), source_url (the specific page the quote came from), excluded_merchants (an array of lowercase keyword strings for anything the terms explicitly carve OUT of this category — this includes both named merchants/retailers, e.g. ["walmart", "target"] for a grocery category that excludes superstores, AND generic purchase-subtype carve-outs stated in the terms, e.g. a travel category excluding tolls should list every common toll-system brand a merchant name might use, not just the word "toll": ["toll", "eztag", "sunpass", "e-zpass", "ezpass", "fastrak", "i-pass", "tollway", "turnpike"], and a travel category excluding car rentals/cruises/rideshare/parking should list ["car rental", "rental car", "cruise", "taxi", "rideshare", "uber", "lyft", "limousine", "parking"]. These are matched the same way as purchase_types — as substrings against the merchant name — so list every keyword/brand a matching merchant name could plausibly contain. null or [] if the terms don't carve anything out.), and included_merchants (an array of lowercase keyword strings for merchant types the card's terms EXPLICITLY count as eligible for this category even though they would normally be classified differently — e.g. a travel category that includes rideshare, parking, or transit should have included_merchants: ["uber", "lyft", "parking", "transit", "taxi", "toll"]; null if the terms don't extend the category beyond its natural scope).
  - For travel: if the card's terms give one rate for booking through the issuer's own travel portal (e.g. Chase Travel, Amex Travel) and a different (usually lower) rate for booking direct with an airline/hotel, add separate "Travel - Portal" and "Travel - Direct" rows. If there is only one travel rate regardless of how it's booked, add a single "Travel - Portal" row AND a single "Travel - Direct" row with the same earn_rate, so both booking methods match.
  - For grocery: if the card's terms give a distinct rate for online grocery delivery/pickup (e.g. Instacart, Amazon Fresh, a supermarket's own delivery/pickup) separate from in-store supermarket purchases, add a separate "Online Grocery" row in addition to "Grocery". If there's only one grocery rate, a plain "Grocery" row is enough — it will be used for online grocery purchases too.
  - purchase_types: when the terms give DIFFERENT rates for different purchase subtypes within the SAME category, emit one row per subtype — each with a purchase_types array of lowercase keyword strings that would appear in a merchant name for that subtype (e.g. ["hotel", "resort", "lodge"] or ["flight", "airline", "airfare"] or ["rental car", "car rental"]). Use short generic terms a merchant name would contain, NOT specific brand names. A row with purchase_types: null is a catch-all for that category; omit the catch-all entirely if the card earns its base rate on any purchases in the category that don't match a named subtype. If the entire category has a single rate for all subtypes, use one row with purchase_types: null.

Only use official issuer sources for the rates themselves (not blogs) — blogs/Reddit are for a separate research step, not this one.

Respond with ONLY a fenced \`\`\`json code block containing an object matching this TypeScript type, and nothing else outside the fence:

{
  "name": string,
  "issuer": string,
  "network": string,
  "reward_type": "cash_back" | "points" | "miles",
  "reward_program": string,
  "base_earn_rate": number,
  "terms_url": string,
  "categories": Array<{
    "category": string,
    "earn_rate": number,
    "cap_amount_cents": number | null,
    "cap_period": "quarterly" | "annual" | null,
    "is_rotating": boolean,
    "source_text": string,
    "source_url": string,
    "excluded_merchants": string[] | null,
    "included_merchants": string[] | null,
    "purchase_types": string[] | null
  }>
}`;

  return researchToJson<CardIngestionResult>(prompt, options);
}
