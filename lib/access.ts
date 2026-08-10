import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessBlockReason = "profile_archived" | "school_archived" | "school_expired" | null;

// Checked first, and overrides everything else: a lifetime-free grant or an active Stripe
// subscription doesn't matter if the person or their whole school has been archived, or their
// school's package has expired. access_expires_at is checked against the current time on
// every call, so a package quietly lapsing cuts access off automatically the moment it
// passes -- no daily job required to actually enforce it. Returns the specific reason so
// /subscribe can explain what happened instead of just showing a generic paywall.
async function getAccessBlockReason(supabase: SupabaseClient, userId: string): Promise<AccessBlockReason> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("archived_at, school_id, schools(archived_at, access_expires_at)")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.archived_at) return "profile_archived";

  const school = (profile as any)?.schools as { archived_at: string | null; access_expires_at: string | null } | null;
  if (school?.archived_at) return "school_archived";
  if (school?.access_expires_at && new Date(school.access_expires_at) < new Date()) return "school_expired";

  return null;
}

// The single place that decides "can this signed-in user actually see question content."
// A beta code sets profiles.access_type to 'lifetime-free' directly (see /api/redeem-code).
// A Stripe subscription sets it to 'paid' via /api/stripe-webhook, but webhooks can lag a
// few seconds behind checkout, so this also checks the subscriptions table directly for
// trialing/active as a fallback, rather than trusting access_type alone at the exact moment
// someone finishes checkout.
export async function hasAccess(supabase: SupabaseClient, userId: string): Promise<boolean> {
  if (await getAccessBlockReason(supabase, userId)) return false;

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

// Used only by /subscribe to explain WHY someone landed there, when the reason is more
// specific than "never subscribed." Returns null if access is fine or the block is just the
// ordinary "hasn't paid/redeemed a code yet" case.
export async function getAccessStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<{ hasAccess: boolean; blockReason: AccessBlockReason }> {
  const blockReason = await getAccessBlockReason(supabase, userId);
  if (blockReason) return { hasAccess: false, blockReason };
  return { hasAccess: await hasAccess(supabase, userId), blockReason: null };
}
