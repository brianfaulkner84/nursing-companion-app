import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Folders are owned by the user, so this uses the regular (RLS-scoped) client, not the
// service role, unlike /api/redeem-code and /api/submit-attempt which need to bypass RLS.
export async function POST(request: Request) {
  const { name, subjects } = await request.json();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  if (!name || !Array.isArray(subjects) || subjects.length === 0) {
    return NextResponse.json({ error: "name and at least one subject are required" }, { status: 400 });
  }

  const { data: folder, error: folderError } = await supabase
    .from("subject_folders")
    .insert({ user_id: user.id, name })
    .select("id")
    .single();

  if (folderError) {
    const message = folderError.code === "23505" ? "You already have an exam with that name." : folderError.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: itemsError } = await supabase
    .from("subject_folder_items")
    .insert(subjects.map((subject: string) => ({ folder_id: folder.id, subject })));

  if (itemsError) {
    // Clean up the orphaned folder so a failed save doesn't leave an empty exam behind.
    await supabase.from("subject_folders").delete().eq("id", folder.id);
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  return NextResponse.json({ id: folder.id });
}
