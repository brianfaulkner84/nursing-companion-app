import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Instructor-only. Gated by comparing the signed-in user's email (already known from Google
// sign-in, nothing new collected) against ADMIN_EMAIL, an env var only Brian's account
// matches. No separate admin flag or login exists yet, this is the simplest thing that works
// for a single-instructor app.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { reply } = await request.json();
  if (!reply || !reply.trim()) {
    return NextResponse.json({ error: "reply is required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("raised_hands")
    .update({
      sent_reply: reply.trim(),
      status: "resolved",
      answered_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("user_id")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? "thread not found" }, { status: 500 });
  }

  // Appended to the thread, same as every other message, so this reply and any that follow
  // it show up in order alongside the student's messages instead of replacing them.
  await admin.from("raised_hand_messages").insert({
    raised_hand_id: params.id,
    user_id: updated.user_id,
    sender: "instructor",
    body: reply.trim(),
  });

  return NextResponse.json({ ok: true });
}
