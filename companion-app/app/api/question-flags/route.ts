import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/roles";

export async function POST(request: Request) {
  const { questionId, reason } = await request.json();
  if (!questionId) return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const viewer = await getViewer(supabase, user);
  const senderRole = viewer.role === "instructor" ? "instructor" : "student";

  const { error } = await supabase.from("question_flags").insert({
    user_id: user.id,
    question_id: questionId,
    reason: reason.trim(),
    sender_role: senderRole,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
