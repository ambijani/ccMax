import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const programs = searchParams.get("programs")?.split(",").filter(Boolean) ?? [];

  const { data, error } = await supabase
    .from("points_valuations")
    .select("*")
    .in("reward_program", programs.length ? programs : ["__none__"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
