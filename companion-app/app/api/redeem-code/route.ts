import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

// Beta codes are never readable from the browser (see supabase/schema.sql, beta_codes
// has no select policy). Redemption happens here, server-side, using the service role,
// so a curious user can't just query the table and list every code that exists.
export async function POST(request: Request) {
  const { code } = await request.json();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const trimmed = (code ?? "").trim().toUpperCase();
  if (!trimmed) return NextResponse.json({ ok: true }); // no code entered, nothing to redeem

  const admin = createAdminClient();
  const { data: betaCode } = await admin
    .from("beta_codes")
    .select("code, grant_type, active")
    .eq("code", trimmed)
    .maybeSingle();

  if (!betaCode || !betaCode.active) {
    return NextResponse.json({ error: "That beta code isn't valid." }, { status: 400 });
  }

  await admin
    .from("profiles")
    .update({ beta_code_used: trimmed, access_type: "lifetime-free" })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
