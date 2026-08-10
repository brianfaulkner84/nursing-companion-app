import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents } from "@/lib/roles";

// Per-question circuit breaker (MNGT 745 Week 6 capstone): a reviewer classifies a flagged
// question as accurate but difficult, needs rewrite, or needs removal. Instructor, school_admin,
// or admin can all do this -- a deliberate, low-bar action, anyone with review authority can
// pull a bad question out of circulation immediately, even knowing it affects every school on
// the platform, not just their own. Only admin can later resolve the hold (see resolve-hold).
// Classifying resolves every open question_flags row for this question at once, since they're
// all about the same underlying content issue.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { classification } = await request.json();
  if (!["accurate", "needs_rewrite", "needs_removal"].includes(classification)) {
    return NextResponse.json({ error: "invalid classification" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const viewer = await getViewer(supabase, user);
  if (!canReviewStudents(viewer.role)) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  const contentStatus =
    classification === "needs_rewrite" ? "needs_rewrite" : classification === "needs_removal" ? "needs_removal" : "live";

  const { error } = await admin
    .from("questions")
    .update({ flag_classification: classification, content_status: contentStatus })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("question_flags").update({ status: "resolved" }).eq("question_id", params.id).eq("status", "open");

  return NextResponse.json({ ok: true });
}
