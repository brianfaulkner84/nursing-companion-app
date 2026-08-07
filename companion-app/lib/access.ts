import type { SupabaseClient } from "@supabase/supabase-js";

// The single place that decides "can this signed-in user actually see question content."
// A beta code sets profiles.access_type to 'lifetime-free' directly (see /api/redeem-code).
// A Stripe subscription sets it to 'paid' via /api/stripe-webhook, but webhooks can lag a
// few seconds behind checkout, so this also checks the subscriptions table directly for
// trialing/active as a fallback, rather than trusting access_type alone at the exact moment
// someone finishes checkout.
export async function hasAccess(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_type")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.access_type === "lifetime-free" || profile?.access_type === "paid") {
    return true;
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  return subscription?.status === "trialing" || subscription?.status === "active";
}
