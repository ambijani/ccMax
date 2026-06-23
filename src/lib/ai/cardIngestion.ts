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

export async function ingestCard(cardName: string): Promise<CardIngestionResult> {
  const prompt = `You are researching the official benefits of the credit card "${cardName}" using web search.

Find its official issuer benefits/terms page and extract:
- issuer, card network (Visa/Mastercard/Amex/Discover)
- reward_type: one of cash_back, points, miles
- reward_program name (e.g. "Chase Ultimate Rewards"); if cash back, use the card's own name
- base_earn_rate: the earn rate on purchases that don't match any bonus category
- terms_url: the canonical official benefits page URL
- categories: a list of bonus categories. Each category must use one of these names where applicable: ${REWARD_CATEGORIES.join(", ")}. For each category include earn_rate, any spending cap (cap_amount_cents in whole US cents, cap_period "quarterly" or "annual", or null if uncapped), is_rotating (true if this bonus category is only active for part of the year and changes on a schedule, like Discover it's or Chase Freedom's quarterly 5% categories — false for permanent bonus categories), source_text (the EXACT quoted sentence from the terms page that confirms this rate), and source_url (the specific page the quote came from).
  - For travel: if the card's terms give one rate for booking through the issuer's own travel portal (e.g. Chase Travel, Amex Travel) and a different (usually lower) rate for booking direct with an airline/hotel, add separate "Travel - Portal" and "Travel - Direct" rows. If there is only one travel rate regardless of how it's booked, add a single "Travel - Portal" row AND a single "Travel - Direct" row with the same earn_rate, so both booking methods match.

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
    "source_url": string
  }>
}`;

  return researchToJson<CardIngestionResult>(prompt);
}
