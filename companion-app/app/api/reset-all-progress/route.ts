import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Clears every attempt the current user has ever made, across every subject -- the "start
// completely over" button, distinct from /api/reset-subject-progress which only clears one
// subject at a time. No subject filter, no question lookup: just every attempts row that
// belongs to this user. RLS also enforces the user_id match, same as the per-subject route.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { error: deleteError, count } = await supabase
    .from("attempts")
    .delete({ count: "exact" })
    .eq("user_id", user.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  return NextResponse.json({ ok: true, cleared: count ?? 0 });
}
