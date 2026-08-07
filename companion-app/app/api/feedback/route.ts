import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/roles";

export async function POST(request: Request) {
  const { category, body } = await request.json();
  if (!body || !body.trim()) {
    return NextResponse.json({ error: "feedback text is required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  // Feedback escalates exactly one level: a student's submission is meant for instructors
  // (and admin), an instructor's is meant for admin only. sender_role is captured here, from
  // the submitter's own profile, not trusted from the request body.
  const viewer = await getViewer(supabase, user);
  const senderRole = viewer.role === "instructor" ? "instructor" : "student";

  const { error } = await supabase.from("app_feedback").insert({
    user_id: user.id,
    category: category && ["general", "bug", "suggestion"].includes(category) ? category : "general",
    body: body.trim(),
    sender_role: senderRole,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
