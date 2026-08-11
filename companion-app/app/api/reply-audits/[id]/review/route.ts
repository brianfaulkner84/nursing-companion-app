import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents } from "@/lib/roles";
import { nextCategoryTier } from "@/lib/tier";

// Admin/instructor marks a sent (auto-sent, high or low priority) reply clean, corrects it, or
// elaborates on it, from the Sent, Needs Review queue in /admin/inbox. One action does three
// things: clears the item from that queue, drives the category trust ladder for the reply's
// subject, and, on a correction or elaboration, sends an actual message to the student -- the
// 48-72 hour promise in the AI disclosure has to be a real message, not just an internal note.
// Correction means the AI's answer was wrong; elaboration means it was right but the instructor
// wants to add more. Only a correction steps the subject back down the trust ladder.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { outcome, text } = await request.json();
  if (!["clean", "corrected", "elaborated"].includes(outcome)) {
    return NextResponse.json({ error: "outcome must be 'clean', 'corrected', or 'elaborated'" }, { status: 400 });
  }
  if ((outcome === "corrected" || outcome === "elaborated") && !(text && text.trim())) {
    return NextResponse.json({ error: "text is required for a correction or elaboration" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const viewer = await getViewer(supabase, user);
  if (!canReviewStudents(viewer.role)) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: audit } = await admin
    .from("reply_audits")
    .select("id, raised_hand_id, subject, reviewed_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (audit.reviewed_at) {
    return NextResponse.json({ error: "already reviewed" }, { status: 409 });
  }

  await admin
    .from("reply_audits")
    .update({
      reviewed_at: new Date().toISOString(),
      was_corrected: outcome === "corrected",
      correction_text: outcome === "corrected" ? text.trim() : null,
      corrected_by: outcome === "corrected" ? user.id : null,
      was_elaborated: outcome === "elaborated",
      elaboration_text: outcome === "elaborated" ? text.trim() : null,
      elaborated_by: outcome === "elaborated" ? user.id : null,
    })
    .eq("id", params.id);

  if (outcome === "corrected" || outcome === "elaborated") {
    const { data: thread } = await admin
      .from("raised_hands")
      .select("user_id")
      .eq("id", audit.raised_hand_id)
      .single();
    if (thread) {
      await admin.from("raised_hand_messages").insert({
        raised_hand_id: audit.raised_hand_id,
        user_id: thread.user_id,
        sender: "instructor",
        sender_id: user.id,
        body: text.trim(),
      });
    }
  }

  const { data: trustRow } = await admin
    .from("category_trust")
    .select("current_tier, consecutive_clean_count")
    .eq("subject", audit.subject)
    .maybeSingle();

  // Elaborating still counts as "clean" for the ladder -- the AI's answer wasn't wrong, the
  // instructor just added to it. Only an actual correction steps the subject back down.
  const next = nextCategoryTier(
    (trustRow?.current_tier as "hold" | "high" | "low") ?? "hold",
    trustRow?.consecutive_clean_count ?? 0,
    outcome === "corrected" ? "corrected" : "clean"
  );

  await admin.from("category_trust").upsert({
    subject: audit.subject,
    current_tier: next.tier,
    consecutive_clean_count: next.consecutiveCleanCount,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
