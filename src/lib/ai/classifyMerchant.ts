import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, FAST_MODEL } from "./anthropic";
import { REWARD_CATEGORIES } from "@/lib/types";

export interface MerchantClassification {
  category: string;
  confidence: "high" | "medium" | "low";
  ambiguous: boolean;
  alternative_categories: string[];
  reasoning: string;
}

export function normalizeMerchantKey(merchantName: string): string {
  return merchantName.trim().toLowerCase();
}

async function getCachedClassification(
  supabase: SupabaseClient,
  merchantKey: string,
): Promise<MerchantClassification | null> {
  const { data, error } = await supabase.rpc("get_merchant_classification_cache", {
    p_merchant_key: merchantKey,
  });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    category: row.category,
    confidence: row.confidence,
    ambiguous: row.ambiguous,
    alternative_categories: row.alternative_categories ?? [],
    reasoning: row.reasoning,
  };
}

async function setCachedClassification(
  supabase: SupabaseClient,
  merchantKey: string,
  classification: MerchantClassification,
): Promise<void> {
  // Best-effort — a cache write failure shouldn't fail the classification.
  await supabase.rpc("set_merchant_classification_cache", {
    p_merchant_key: merchantKey,
    p_category: classification.category,
    p_confidence: classification.confidence,
    p_ambiguous: classification.ambiguous,
    p_alternative_categories: classification.alternative_categories,
    p_reasoning: classification.reasoning,
  });
}

export async function classifyMerchant(
  supabase: SupabaseClient,
  merchantName: string,
): Promise<MerchantClassification> {
  const merchantKey = normalizeMerchantKey(merchantName);

  const cached = await getCachedClassification(supabase, merchantKey);
  if (cached) return cached;

  const classification = await classifyMerchantViaAI(merchantName);
  await setCachedClassification(supabase, merchantKey, classification);
  return classification;
}

async function classifyMerchantViaAI(merchantName: string): Promise<MerchantClassification> {
  const prompt = `Classify the purchase "${merchantName}" (this may be a merchant name like "Costco" or a description of what's being bought, like "plane ticket" or "groceries") into exactly one credit card reward category from this list: ${REWARD_CATEGORIES.join(", ")}.

Apply these rules:
- Costco and other membership warehouse clubs -> "Wholesale", not "Grocery" (most cards treat warehouse clubs differently from supermarkets).
- Target, Walmart, and other big-box/superstore retailers -> "General", not "Grocery", even if the specific item bought is food (e.g. "Chips from Target"). Many grocery bonus categories explicitly exclude superstores like these, so default to "General" rather than risking a false match — note this tradeoff in your reasoning.
- Amazon.com purchases -> "Online Shopping", not "General" (treat marketplace/e-commerce platforms as their own category) — UNLESS it's specifically groceries/Amazon Fresh/Whole Foods delivery, which is "Online Grocery".
- Buying groceries through an online grocery delivery/pickup service (e.g. Instacart, Amazon Fresh, Whole Foods delivery, a supermarket's own delivery/pickup site or app) -> "Online Grocery", not "Online Shopping" or "Grocery".
- Buying groceries in person at a physical supermarket -> "Grocery".
- Rideshare and local transportation services (Uber rides, Lyft, taxis, bike/scooter share) -> "General", NOT "Travel - Direct" or "Travel - Portal". These are everyday local transport, not travel bookings. Exception: Uber Eats and food delivery orders from Uber -> "Dining/Restaurants".
- Booking travel through a card issuer's own portal (e.g. "Chase Travel", "Amex Travel", "Capital One Travel", "Citi Travel") -> "Travel - Portal".
- Booking directly with an airline, hotel, car rental, or other travel provider's own site/app (e.g. "United Airlines", "Marriott.com", "Delta", "Expedia" when not noted as a card portal) -> "Travel - Direct". This also covers vague trip mentions like "plane ticket" or "hotel" when no portal is named. Do NOT use this for rideshare or local taxi services.
- If the wording doesn't make clear whether a portal or the provider's own site was used, set ambiguous=true and list both "Travel - Portal" and "Travel - Direct" in alternative_categories.
- If you are genuinely unsure between two categories, set ambiguous=true and list both in alternative_categories so the user can pick.

Respond with ONLY a fenced \`\`\`json code block containing:
{
  "category": string,
  "confidence": "high" | "medium" | "low",
  "ambiguous": boolean,
  "alternative_categories": string[],
  "reasoning": string
}`;

  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");

  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!match) throw new Error(`No JSON found in classification response: ${text.slice(0, 300)}`);
  return JSON.parse(match[1]) as MerchantClassification;
}
