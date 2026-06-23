import { anthropic, MODEL } from "./anthropic";
import { REWARD_CATEGORIES } from "@/lib/types";

export interface MerchantClassification {
  category: string;
  confidence: "high" | "medium" | "low";
  ambiguous: boolean;
  alternative_categories: string[];
  reasoning: string;
}

export async function classifyMerchant(merchantName: string): Promise<MerchantClassification> {
  const prompt = `Classify the purchase "${merchantName}" (this may be a merchant name like "Costco" or a description of what's being bought, like "plane ticket" or "groceries") into exactly one credit card reward category from this list: ${REWARD_CATEGORIES.join(", ")}.

Apply these rules:
- Costco and other membership warehouse clubs -> "Wholesale", not "Grocery" (most cards treat warehouse clubs differently from supermarkets).
- Amazon.com purchases -> "Online Shopping", not "General" (treat marketplace/e-commerce platforms as their own category).
- Booking travel through a card issuer's own portal (e.g. "Chase Travel", "Amex Travel", "Capital One Travel", "Citi Travel") -> "Travel - Portal".
- Booking directly with an airline, hotel, or other travel provider's own site/app (e.g. "United Airlines", "Marriott.com", "Delta", "Expedia" when not noted as a card portal) -> "Travel - Direct". This also covers vague trip mentions like "plane ticket" or "hotel" when no portal is named.
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
    model: MODEL,
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
