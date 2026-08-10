import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAccess } from "@/lib/access";
import { getReportCard } from "@/lib/report-card";
import ReportCardView from "@/components/report-card-view";

// Same reasoning as /dashboard: this needs a fresh read of the student's own attempts on
// every load, not a cached snapshot from whenever the route was first hit.
export const dynamic = "force-dynamic";

export default async function ReportCard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await hasAccess(supabase, user.id))) redirect("/subscribe");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const report = await getReportCard(supabase, user.id);

  return <ReportCardView report={report} studentName={profile?.display_name ?? null} />;
}
