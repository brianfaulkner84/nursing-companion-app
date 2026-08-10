import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents, getSchoolUserIds } from "@/lib/roles";

// Bulk-hides every answered thread from /admin/inbox. Only sets archived_by_instructor, never
// touches the underlying rows, so the student's own Inbox is completely unaffected, this is
// purely decluttering the instructor's queue.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const viewer = await getViewer(supabase, user);
  if (!canReviewStudents(viewer.role)) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Admin clears across every school. An instructor only clears their own school's threads,
  // same scoping /admin/inbox reads with.
  let query = admin
    .from("raised_hands")
    .update({ archived_by_instructor: true })
    .eq("status", "resolved")
    .eq("archived_by_instructor", false);

  if (viewer.role === "instructor") {
    const studentIds = await getSchoolUserIds(admin, viewer.schoolId);
    query = query.in("user_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data, error } = await query.select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, cleared: data?.length ?? 0 });
}
