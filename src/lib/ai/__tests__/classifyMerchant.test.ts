import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../anthropic", () => ({
  anthropic: { messages: { create: vi.fn() } },
  FAST_MODEL: "claude-haiku-5-5",
}));

import { anthropic, FAST_MODEL } from "../anthropic";
import { classifyMerchant, normalizeMerchantKey } from "../classifyMerchant";

function fakeSupabase(getResult: unknown, setResult: unknown = { data: null, error: null }) {
  const rpc = vi.fn((fn: string) => {
    if (fn === "get_merchant_classification_cache") return Promise.resolve(getResult);
    if (fn === "set_merchant_classification_cache") return Promise.resolve(setResult);
    throw new Error(`unexpected rpc: ${fn}`);
  });
  return { rpc };
}

function fencedJsonResponse(obj: unknown) {
  return {
    content: [{ type: "text", text: "```json\n" + JSON.stringify(obj) + "\n```" }],
  };
}

describe("normalizeMerchantKey", () => {
  it("trims and lowercases", () => {
    expect(normalizeMerchantKey("  Starbucks  ")).toBe("starbucks");
  });
});

describe("classifyMerchant", () => {
  beforeEach(() => {
    vi.mocked(anthropic.messages.create).mockReset();
  });

  it("returns the cached classification without calling the AI on a cache hit", async () => {
    const cached = {
      category: "Dining/Restaurants",
      confidence: "high" as const,
      ambiguous: false,
      alternative_categories: [],
      reasoning: "cached",
    };
    const supabase = fakeSupabase({
      data: [
        {
          category: cached.category,
          confidence: cached.confidence,
          ambiguous: cached.ambiguous,
          alternative_categories: cached.alternative_categories,
          reasoning: cached.reasoning,
        },
      ],
      error: null,
    });

    const result = await classifyMerchant(supabase as never, "Starbucks");

    expect(result).toEqual(cached);
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });

  it("calls the AI with FAST_MODEL and writes the cache on a cache miss", async () => {
    const fresh = {
      category: "Dining/Restaurants",
      confidence: "high" as const,
      ambiguous: false,
      alternative_categories: [],
      reasoning: "fresh classification",
    };
    vi.mocked(anthropic.messages.create).mockResolvedValue(fencedJsonResponse(fresh) as never);
    const supabase = fakeSupabase({ data: [], error: null });

    const result = await classifyMerchant(supabase as never, "Starbucks");

    expect(result).toEqual(fresh);
    expect(anthropic.messages.create).toHaveBeenCalledTimes(1);
    expect(anthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: FAST_MODEL }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "set_merchant_classification_cache",
      expect.objectContaining({ p_merchant_key: "starbucks", p_category: fresh.category }),
    );
  });
});
