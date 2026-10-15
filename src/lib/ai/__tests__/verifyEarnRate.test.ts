import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

vi.mock("../anthropic", () => ({
  anthropic: { messages: { create: vi.fn() } },
  FAST_MODEL: "claude-haiku-5-5",
}));

import { anthropic, FAST_MODEL } from "../anthropic";
import { verifyEarnRate } from "../verifyEarnRate";

function fakeSupabase(getResult: unknown, setResult: unknown = { data: null, error: null }) {
  const rpc = vi.fn((fn: string) => {
    if (fn === "get_earn_rate_verification_cache") return Promise.resolve(getResult);
    if (fn === "set_earn_rate_verification_cache") return Promise.resolve(setResult);
    throw new Error(`unexpected rpc: ${fn}`);
  });
  return { rpc };
}

function textResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

const sourceText = "5% on gas stations, excludes supermarket fuel pumps.";
const sourceTextHash = createHash("sha256").update(sourceText).digest("hex");

describe("verifyEarnRate", () => {
  beforeEach(() => {
    vi.mocked(anthropic.messages.create).mockReset();
  });

  it("returns the cached verification without calling the AI on a cache hit", async () => {
    const supabase = fakeSupabase({
      data: [{ qualifies: false, note: "cached caveat" }],
      error: null,
    });

    const result = await verifyEarnRate(
      supabase as never,
      "Shell",
      "Gas",
      5,
      "Chase Freedom",
      "cash_back",
      sourceText,
    );

    expect(result).toEqual({ qualifies: false, note: "cached caveat" });
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });

  it("calls the AI with FAST_MODEL and writes the cache on a cache miss, keyed by the source text hash", async () => {
    vi.mocked(anthropic.messages.create).mockResolvedValue(
      textResponse("YES: qualifies at standalone gas stations.") as never,
    );
    const supabase = fakeSupabase({ data: [], error: null });

    const result = await verifyEarnRate(
      supabase as never,
      "Shell",
      "Gas",
      5,
      "Chase Freedom",
      "cash_back",
      sourceText,
    );

    expect(result).toEqual({ qualifies: true, note: "qualifies at standalone gas stations." });
    expect(anthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: FAST_MODEL }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "set_earn_rate_verification_cache",
      expect.objectContaining({
        p_merchant_key: "shell",
        p_card_name: "Chase Freedom",
        p_category: "Gas",
        p_source_text_hash: sourceTextHash,
        p_qualifies: true,
        p_note: "qualifies at standalone gas stations.",
      }),
    );
  });
});
