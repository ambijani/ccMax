import { anthropic, MODEL } from "./anthropic";
import type { RewardType } from "@/lib/types";

export async function verifyEarnRate(
  merchantName: string,
  category: string,
  earnRate: number,
  cardName: string,
  rewardType: RewardType,
  sourceText: string,
): Promise<string> {
  const unit = rewardType === "cash_back" ? "% cash back" : `× ${rewardType} per $1`;
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Card: ${cardName}
Merchant: ${merchantName}
Category: ${category}
Earn rate: ${earnRate}${unit}

Official benefit text:
${sourceText}

Does this merchant qualify for this earn rate? Any caveats or conditions the user should know? Reply in 1–2 sentences, plain text only.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  return text.trim();
}
