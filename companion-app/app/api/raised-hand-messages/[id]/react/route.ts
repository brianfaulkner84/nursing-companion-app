import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Student reacts to a specific instructor-sent message (thumbs up/down). Replaces the old
// thread-level "Flag This Reply" button: this is per-message instead of per-thread, and it works
// on a human-written reply the same as an AI auto-sent one, not just AI replies. A down reaction
// escalates the whole thread exactly the way Flag used to (bumps it to the top of the Sent,
// Needs Review queue); a null reaction clears whatever was there. Reaction data also feeds the
// engagement sweep in the daily cron, which is the actual reason this exists: without some
// signal on the student's side, a thread that silently never reached them looks identical to one
// they simply had nothing to say about.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { reaction } = await request.json();
  if (reaction !== "up" && reaction !== "down" && reaction !== null) {
    return NextResponse.json({ error: "reaction must be 'up', 'down', or null" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: message } = await admin
    .from("raised_hand_messages")
    .select("id, raised_hand_id, sender, user_id, is_acknowledgment, is_checkin")
    .eq("id", params.id)
    .maybeSingle();

  // user_id on every message in a thread is always the student's id (see schema.sql), so this
  // alone confirms the reacting user owns the thread -- no separate raised_hands lookup needed.
  if (!message || message.user_id !== user.id || message.sender !== "instructor") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (message.is_acknowledgment || message.is_checkin) {
    return NextResponse.json({ error: "nothing to react to on a status message" }, { status: 400 });
  }

  await admin.from("raised_hand_messages").update({ reaction }).eq("id", params.id);

  if (reaction === "down") {
    await admin
      .from("raised_hands")
      .update({ escalated_at: new Date().toISOString() })
      .eq("id", message.raised_hand_id);
  }

  return NextResponse.json({ ok: true });
}
