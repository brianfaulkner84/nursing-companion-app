import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessStatus } from "@/lib/access";
import SubscribeForm from "@/components/subscribe-form";

// force-dynamic for the same reason as /dashboard: this needs the current archived/expired
// state on every load, not a cached snapshot from whenever the route was first hit.
export const dynamic = "force-dynamic";

export default async function Subscribe() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { hasAccess, blockReason } = await getAccessStatus(supabase, user.id);
  if (hasAccess) redirect("/dashboard");

  return <SubscribeForm blockReason={blockReason} />;
}
