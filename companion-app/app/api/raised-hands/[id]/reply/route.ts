import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Student sends a follow-up message on a thread they already started (new or already
// answered). Reopens the thread, the instructor's daily reminder cron already checks for any
// status = 'open' raised hand older than 2 days, so a fresh follow-up gets picked up the same
// way an original raised hand would, no extra notification path needed.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { message } = await request.json();
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

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

  await admin.from("raised_hand_messages").insert({
    raised_hand_id: params.id,
    user_id: user.id,
    sender: "student",
    body: message.trim(),
  });

  // Replying means they're clearly not done with it, even if they'd archived it earlier.
  await admin.from("raised_hands").update({ status: "open", archived_by_student: false }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
