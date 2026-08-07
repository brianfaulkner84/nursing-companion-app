import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents } from "@/lib/roles";

// Instructor or admin. profiles.role is the source of truth now (see lib/roles.ts); any
// signed-in instructor can answer any open thread, not just the one admin account.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { reply } = await request.json();
  if (!reply || !reply.trim()) {
    return NextResponse.json({ error: "reply is required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const viewer = await getViewer(supabase, user);
  if (!canReviewStudents(viewer.role)) {
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
  // it show up in order alongside the student's messages instead of replacing them. sender_id
  // records which instructor actually sent it, distinct from user_id (always the student's,
  // kept that way for RLS) -- lets admin audit who handled what once more than one instructor
  // exists.
  await admin.from("raised_hand_messages").insert({
    raised_hand_id: params.id,
    user_id: updated.user_id,
    sender: "instructor",
    sender_id: user.id,
    body: reply.trim(),
  });

  return NextResponse.json({ ok: true });
}
