import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents, getSchoolUserIds } from "@/lib/roles";
import AdminFeedbackList from "@/components/admin-feedback-list";

export const dynamic = "force-dynamic";

export default async function AdminFeedback() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const viewer = await getViewer(supabase, user);
  if (!canReviewStudents(viewer.role)) redirect("/dashboard");

  const admin = createAdminClient();

  // Feedback escalates one level: an instructor's own submission goes to admin only, so an
  // instructor's view excludes sender_role='instructor' rows entirely -- they never see each
  // other's (or their own) escalations sitting in a shared queue. Admin sees everything,
  // across every school. An instructor's view is also scoped to their own school's students.
  let feedbackQuery = admin.from("app_feedback").select("id, category, body, status, sender_role, created_at").order("created_at", { ascending: false });
  let flagsQuery = admin
    .from("question_flags")
    .select("id, reason, status, sender_role, created_at, questions(subject, title, question_text)")
    .order("created_at", { ascending: false });

  if (viewer.role === "instructor") {
    const studentIds = await getSchoolUserIds(admin, viewer.schoolId);
    const scoped = studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"];
    feedbackQuery = feedbackQuery.eq("sender_role", "student").in("user_id", scoped);
    flagsQuery = flagsQuery.eq("sender_role", "student").in("user_id", scoped);
  }

  const [{ data: feedback }, { data: flags }] = await Promise.all([feedbackQuery, flagsQuery]);

  const newFeedback = (feedback ?? []).filter((f) => f.status === "new");
  const reviewedFeedback = (feedback ?? []).filter((f) => f.status === "reviewed");
  const openFlags = (flags ?? []).filter((f) => f.status === "open");
  const resolvedFlags = (flags ?? []).filter((f) => f.status === "resolved");

  return (
    <div>
      <h1>Feedback</h1>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        General app feedback from beta testers, and specific questions they've flagged as
        having a content problem.
        {viewer.role === "admin" && " This includes feedback instructors have sent you directly, marked below."}
      </p>

      <AdminFeedbackList
        newFeedback={newFeedback as any}
        reviewedFeedback={reviewedFeedback as any}
        openFlags={openFlags as any}
        resolvedFlags={resolvedFlags as any}
      />

      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
