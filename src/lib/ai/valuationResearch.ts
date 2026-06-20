import { researchToJson } from "./anthropic";
import type { ValuationSource } from "@/lib/types";

export interface ValuationResearchResult {
  reward_program: string;
  cpp_conservative: number;
  cpp_optimistic: number;
  cpp_community: number;
  valuation_notes: string;
  sources: ValuationSource[];
}

export async function researchPointsValuation(
  rewardProgram: string,
): Promise<ValuationResearchResult> {
  const prompt = `Research the current community-consensus value of "${rewardProgram}" points/miles using web search.

Search r/churning, r/creditcards, r/personalfinance, The Points Guy, and Doctor of Credit for recent discussion (prefer the last 6 months).

Determine:
- cpp_conservative: cents-per-point cash-out/statement-credit value
- cpp_optimistic: cents-per-point best-case transfer partner redemption value
- cpp_community: the current community consensus "average" cents-per-point value people actually use when comparing cards
- valuation_notes: 2-4 plain-language sentences summarizing how people are actually redeeming these points right now (e.g. specific transfer partners, new redemption options like Paze, limited-time transfer bonuses)
- sources: an array of the specific pages/threads you used, each as {url, title, date, key_insight} where date is the publish date if known (else your best estimate) and key_insight is one sentence on what that source told you

Respond with ONLY a fenced \`\`\`json code block containing:
{
  "reward_program": string,
  "cpp_conservative": number,
  "cpp_optimistic": number,
  "cpp_community": number,
  "valuation_notes": string,
  "sources": Array<{ "url": string, "title": string, "date": string, "key_insight": string }>
}`;

  return researchToJson<ValuationResearchResult>(prompt);
}
