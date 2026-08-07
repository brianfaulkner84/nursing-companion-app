import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Bulk-hides every answered thread from /admin/inbox. Only sets archived_by_instructor, never
// touches the underlying rows, so the student's own Inbox is completely unaffected, this is
// purely decluttering the instructor's queue.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("raised_hands")
    .update({ archived_by_instructor: true })
    .eq("status", "resolved")
    .eq("archived_by_instructor", false)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, cleared: data?.length ?? 0 });
}
