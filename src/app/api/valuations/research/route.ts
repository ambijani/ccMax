import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { researchPointsValuation } from "@/lib/ai/valuationResearch";

export async function POST(request: Request) {
  // Require a signed-in user to trigger research, but write with the admin
  // client since points_valuations is shared reference data with no per-user
  // insert policy.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rewardProgram } = await request.json();
  if (!rewardProgram || typeof rewardProgram !== "string") {
    return NextResponse.json({ error: "rewardProgram is required" }, { status: 400 });
  }

  try {
    const result = await researchPointsValuation(rewardProgram);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("points_valuations")
      .upsert(
        {
          reward_program: result.reward_program,
          cpp_conservative: result.cpp_conservative,
          cpp_optimistic: result.cpp_optimistic,
          cpp_community: result.cpp_community,
          cpp_portal: result.cpp_portal,
          valuation_notes: result.valuation_notes,
          sources: result.sources,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "reward_program" },
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Valuation research failed" },
      { status: 502 },
    );
  }
}
