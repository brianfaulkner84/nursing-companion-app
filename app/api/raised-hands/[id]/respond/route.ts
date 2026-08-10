import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents } from "@/lib/roles";
import { nextCategoryTier } from "@/lib/tier";

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
    .select("user_id, claude_draft_reply")
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

  // Tiered AI reply review (MNGT 745 Week 6 capstone): this is the only place a hold-tier
  // thread ever gets reviewed, so it's also the only place a subject stuck at "hold" can ever
  // earn its way onto the trust ladder in the first place. Sending the draft unedited counts as
  // a clean review; editing it before sending counts as a correction, the same as correcting an
  // auto-sent reply does in /api/reply-audits/[id]/review. Threads from before this migration,
  // or any hold whose audit row is already marked reviewed for some other reason, have nothing
  // to update here and are skipped.
  const { data: audit } = await admin
    .from("reply_audits")
    .select("id, subject, reviewed_at")
    .eq("raised_hand_id", params.id)
    .is("reviewed_at", null)
    .maybeSingle();

  if (audit) {
    const wasEdited = (updated.claude_draft_reply ?? "").trim() !== reply.trim();
    await admin
      .from("reply_audits")
      .update({
        reviewed_at: new Date().toISOString(),
        was_corrected: wasEdited,
        correction_text: wasEdited ? reply.trim() : null,
        corrected_by: wasEdited ? user.id : null,
      })
      .eq("id", audit.id);

    const { data: trustRow } = await admin
      .from("category_trust")
      .select("current_tier, consecutive_clean_count")
      .eq("subject", audit.subject)
      .maybeSingle();

    const next = nextCategoryTier(
      (trustRow?.current_tier as "hold" | "high" | "low") ?? "hold",
      trustRow?.consecutive_clean_count ?? 0,
      wasEdited ? "corrected" : "clean"
    );

    await admin.from("category_trust").upsert({
      subject: audit.subject,
      current_tier: next.tier,
      consecutive_clean_count: next.consecutiveCleanCount,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
