import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Students can delete their own messages (typo, changed their mind, whatever). Instructor
// messages are never deletable through this route, checked server-side, not just hidden in
// the UI.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: message } = await admin
    .from("raised_hand_messages")
    .select("id, user_id, sender")
    .eq("id", params.id)
    .maybeSingle();

  if (!message || message.user_id !== user.id || message.sender !== "student") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await admin.from("raised_hand_messages").delete().eq("id", params.id);

  return NextResponse.json({ ok: true });
}
