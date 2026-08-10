import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, isAdmin } from "@/lib/roles";

// Resolving a held question (MNGT 745 Week 6 capstone): admin-only, three actions. Rewriting or
// removing shared content affects every school, not just one, so this stays admin-only even
// though school_admin can trigger the hold in the first place -- that decision needs a single
// accountable owner. "Rewrite" and "unflag" both mean the content problem is settled and the
// question goes back into service; the actual text edit, if any, happens separately (there's no
// inline question editor in this build). "Remove" keeps the question permanently out of service
// rather than deleting the row -- attempts and raised hands reference it, and this app never
// hard-deletes content that other rows depend on.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { action } = await request.json();
  if (!["rewrite", "remove", "unflag"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const viewer = await getViewer(supabase, user);
  if (!isAdmin(viewer.role)) {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const admin = createAdminClient();

  if (action === "remove") {
    const { error } = await admin
      .from("questions")
      .update({ content_status: "needs_removal" })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("questions")
      .update({ content_status: "live", flag_classification: null })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
