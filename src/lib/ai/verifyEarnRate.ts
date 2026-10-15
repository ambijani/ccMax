import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, FAST_MODEL } from "./anthropic";
import type { RewardType } from "@/lib/types";
import { normalizeMerchantKey } from "./classifyMerchant";

export interface EarnRateVerification {
  qualifies: boolean;
  note: string;
}

function hashSourceText(sourceText: string): string {
  return createHash("sha256").update(sourceText).digest("hex");
}

async function getCachedVerification(
  supabase: SupabaseClient,
  merchantKey: string,
  cardName: string,
  category: string,
  sourceTextHash: string,
): Promise<EarnRateVerification | null> {
  const { data, error } = await supabase.rpc("get_earn_rate_verification_cache", {
    p_merchant_key: merchantKey,
    p_card_name: cardName,
    p_category: category,
    p_source_text_hash: sourceTextHash,
  });
  if (error || !data || data.length === 0) return null;
  return { qualifies: data[0].qualifies, note: data[0].note };
}

async function setCachedVerification(
  supabase: SupabaseClient,
  merchantKey: string,
  cardName: string,
  category: string,
  sourceTextHash: string,
  verification: EarnRateVerification,
): Promise<void> {
  // Best-effort — a cache write failure shouldn't fail the verification.
  await supabase.rpc("set_earn_rate_verification_cache", {
    p_merchant_key: merchantKey,
    p_card_name: cardName,
    p_category: category,
    p_source_text_hash: sourceTextHash,
    p_qualifies: verification.qualifies,
    p_note: verification.note,
  });
}

export async function verifyEarnRate(
  supabase: SupabaseClient,
  merchantName: string,
  category: string,
  earnRate: number,
  cardName: string,
  rewardType: RewardType,
  sourceText: string,
): Promise<EarnRateVerification> {
  const merchantKey = normalizeMerchantKey(merchantName);
  const sourceTextHash = hashSourceText(sourceText);

  const cached = await getCachedVerification(supabase, merchantKey, cardName, category, sourceTextHash);
  if (cached) return cached;

  const verification = await verifyEarnRateViaAI(merchantName, category, earnRate, cardName, rewardType, sourceText);
  await setCachedVerification(supabase, merchantKey, cardName, category, sourceTextHash, verification);
  return verification;
}

async function verifyEarnRateViaAI(
  merchantName: string,
  category: string,
  earnRate: number,
  cardName: string,
  rewardType: RewardType,
  sourceText: string,
): Promise<EarnRateVerification> {
  const unit = rewardType === "cash_back" ? "% cash back" : `× ${rewardType} per $1`;
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
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
