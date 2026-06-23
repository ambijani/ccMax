import type { SupabaseClient } from "@supabase/supabase-js";

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  route: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_user_id: userId,
    p_route: route,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  // Fail open on an infra hiccup rather than block every user over one error.
  if (error) return true;
  return data === true;
}
