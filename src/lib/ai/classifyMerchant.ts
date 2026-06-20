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
  const prompt = `Classify the merchant "${merchantName}" into exactly one credit card reward category from this list: ${REWARD_CATEGORIES.join(", ")}.

Apply these rules:
- Costco and other membership warehouse clubs -> "Wholesale", not "Grocery" (most cards treat warehouse clubs differently from supermarkets).
- Amazon.com purchases -> "Online Shopping", not "General" (treat marketplace/e-commerce platforms as their own category).
- Airline or hotel websites/apps -> "Travel", but note in your reasoning if the merchant is also a card issuer's own travel portal (some cards only bonus purchases made directly through their portal, not the airline's own site).
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
