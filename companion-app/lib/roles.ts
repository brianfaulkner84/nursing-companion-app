import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

// 'school_admin' is scaffolded (a valid value everywhere it's checked below) but nothing
// grants it yet -- no route redeems a school_admin code, no UI sets it. It's an instructor
// with elevated permissions scoped to their own school (remove people, downgrade roles,
// manage that school's codes), as opposed to 'admin' which is global. Those capabilities
// aren't built; when they are, they belong behind their own helper here, scoped by school_id
// the same way getSchoolUserIds already scopes an instructor's queues.
export type Role = "student" | "instructor" | "school_admin" | "admin";

export type Viewer = { role: Role; schoolId: string | null };

// The single place that decides who a signed-in user is allowed to act as. profiles.role is
// the real source of truth (set only through service-role writes, see the
// prevent_self_privilege_escalation trigger in schema.sql). ADMIN_EMAIL is kept as a fallback
// promotion to 'admin' so the one known admin account is never locked out by a profile row
// that hasn't been created or migrated yet -- belt-and-suspenders, not the primary path.
export async function getViewer(supabase: SupabaseClient, user: User): Promise<Viewer> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .maybeSingle();

  let role: Role = (profile?.role as Role) ?? "student";
  if (role !== "admin" && !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
    role = "admin";
  }

  return { role, schoolId: profile?.school_id ?? null };
}

export function canReviewStudents(role: Role): boolean {
  return role === "instructor" || role === "school_admin" || role === "admin";
}

export function isAdmin(role: Role): boolean {
  return role === "admin";
}

// The set of student/instructor profile ids belonging to one school, for scoping an
// instructor's review queues (raised_hands, app_feedback, question_flags) to their own
// school. Admin never calls this -- admin sees every school unfiltered, which is the whole
// point of the admin role. raised_hands/app_feedback/question_flags reference auth.users
// directly rather than profiles, so there's no single-query join; this two-step (get the ids,
// then filter by them) matches how the rest of the app already composes queries in JS.
export async function getSchoolUserIds(admin: SupabaseClient, schoolId: string | null): Promise<string[]> {
  if (!schoolId) return [];
  const { data } = await admin.from("profiles").select("id").eq("school_id", schoolId);
  return (data ?? []).map((p) => p.id as string);
}
