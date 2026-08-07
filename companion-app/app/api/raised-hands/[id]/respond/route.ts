import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Instructor-only. Gated by comparing the signed-in user's email (already known from Google
// sign-in, nothing new collected) against ADMIN_EMAIL, an env var only Brian's account
// matches. No separate admin flag or login exists yet, this is the simplest thing that works
// for a single-instructor app.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { reply } = await request.json();
  if (!reply || !reply.trim()) {
    return NextResponse.json({ error: "reply is required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("raised_hands")
    .update({
      sent_reply: reply.trim(),
      status: "resolved",
      answered_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
