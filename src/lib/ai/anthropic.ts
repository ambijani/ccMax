import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const MODEL = "claude-sonnet-4-6";

// Small, constrained-output classification/verification tasks (merchant
// category pick, YES/NO earn-rate check) don't need Sonnet-tier reasoning.
export const FAST_MODEL = "claude-haiku-5-5";

const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 8,
};

/**
 * Runs a web-search-enabled prompt and extracts the JSON object the model is
 * instructed to emit as the final fenced ```json block (text before/after it
 * is the model's research narration, which callers can ignore).
 */
export async function researchToJson<T>(prompt: string, options?: { signal?: AbortSignal }): Promise<T> {
  const response = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: 4096,
      tools: [WEB_SEARCH_TOOL],
      messages: [{ role: "user", content: prompt }],
    },
    { signal: options?.signal },
  );

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("\n");

  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!match) {
    throw new Error(`No JSON found in Claude response: ${text.slice(0, 500)}`);
  }
  return JSON.parse(match[1]) as T;
}
