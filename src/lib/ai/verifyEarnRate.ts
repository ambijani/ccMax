import { anthropic, MODEL } from "./anthropic";
import type { RewardType } from "@/lib/types";

export interface EarnRateVerification {
  qualifies: boolean;
  note: string;
}

export async function verifyEarnRate(
  merchantName: string,
  category: string,
  earnRate: number,
  cardName: string,
  rewardType: RewardType,
  sourceText: string,
): Promise<EarnRateVerification> {
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

Does this merchant qualify for this earn rate? Start your reply with exactly "YES:" if it qualifies at this rate with no disqualifying caveat, or "NO:" if the terms actually exclude this merchant/purchase type despite the category match. Follow with 1–2 sentences explaining any caveats or conditions the user should know, plain text only.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  const qualifies = !/^NO:/i.test(text);
  const note = text.replace(/^(YES|NO):\s*/i, "");
  return { qualifies, note };
}
