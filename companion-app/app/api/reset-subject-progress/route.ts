import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Clears the current user's own attempt history for one subject, so those questions go
// back to "unattempted" and reappear in quizzes/reviews. Doesn't touch the questions
// themselves or any other student's attempts, RLS also enforces the user_id match.
export async function POST(request: Request) {
  const { subject } = await request.json();
  if (!subject) return NextResponse.json({ error: "subject is required" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data: questions, error: qError } = await supabase
    .from("questions")
    .select("id")
    .eq("subject", subject);
  if (qError) return NextResponse.json({ error: qError.message }, { status: 400 });

  const questionIds = (questions ?? []).map((q) => q.id);
  if (questionIds.length === 0) return NextResponse.json({ ok: true, cleared: 0 });

  const { error: deleteError, count } = await supabase
    .from("attempts")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .in("question_id", questionIds);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  return NextResponse.json({ ok: true, cleared: count ?? 0 });
}
