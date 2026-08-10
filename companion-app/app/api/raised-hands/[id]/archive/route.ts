import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Student archives or restores their own thread. Only ever touches
// archived_by_instructor's sibling column, archived_by_student, so this never affects what
// the instructor sees in /admin/inbox.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { archived } = await request.json();
  if (typeof archived !== "boolean") {
    return NextResponse.json({ error: "archived (boolean) is required" }, { status: 400 });
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

  await admin.from("raised_hands").update({ archived_by_student: archived }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
