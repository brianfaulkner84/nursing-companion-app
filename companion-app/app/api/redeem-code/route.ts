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
    .select("code, grant_type, active, role, school_id")
    .eq("code", trimmed)
    .maybeSingle();

  if (!betaCode || !betaCode.active) {
    return NextResponse.json({ error: "That beta code isn't valid." }, { status: 400 });
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // role and school_id come from the code, not the request -- a code for a specific school's
  // instructor batch grants "instructor" + that school's id, a student code grants "student"
  // + that school's id. Redemption only ever escalates a role, never downgrades: a code can
  // only grant 'student' or 'instructor' (see the check constraint on beta_codes.role), so
  // without this guard, an admin or instructor testing a random student code would silently
  // demote themselves. This write goes through the service role, which is the only thing
  // allowed to change these columns on profiles (see prevent_self_privilege_escalation).
  const rolePrecedence: Record<string, number> = { student: 0, instructor: 1, admin: 2 };
  const currentRole = existingProfile?.role ?? "student";
  const codeRole = betaCode.role ?? "student";
  const nextRole = (rolePrecedence[codeRole] ?? 0) > (rolePrecedence[currentRole] ?? 0) ? codeRole : currentRole;

  await admin
    .from("profiles")
    .update({
      beta_code_used: trimmed,
      access_type: "lifetime-free",
      role: nextRole,
      school_id: betaCode.school_id ?? null,
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
