import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Student flags an AI-auto-sent reply as wrong ("Flag This Reply" in /inbox). Sets
// escalated_at, which bumps this thread to the top of the Sent, Needs Review queue in
// /admin/inbox, ahead of routine spot-checks. See the design summary's student-facing
// disclosure and escalation section.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: thread } = await admin
    .from("raised_hands")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!thread || thread.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await admin.from("raised_hands").update({ escalated_at: new Date().toISOString() }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
