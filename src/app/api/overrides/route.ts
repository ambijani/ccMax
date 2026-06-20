import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.from("user_cpp_overrides").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rewardProgram, cppOverride } = await request.json();
  if (!rewardProgram || typeof cppOverride !== "number") {
    return NextResponse.json(
      { error: "rewardProgram and cppOverride are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("user_cpp_overrides")
    .upsert(
      { user_id: user.id, reward_program: rewardProgram, cpp_override: cppOverride },
      { onConflict: "user_id,reward_program" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rewardProgram } = await request.json();
  const { error } = await supabase
    .from("user_cpp_overrides")
    .delete()
    .eq("reward_program", rewardProgram);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
