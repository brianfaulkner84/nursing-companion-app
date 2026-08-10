import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents, isAdmin, getSchoolUserIds } from "@/lib/roles";
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
    .select("id, question_id, reason, status, sender_role, created_at, questions(subject, title, question_text)")
    .order("created_at", { ascending: false });

  if (viewer.role === "instructor") {
    const studentIds = await getSchoolUserIds(admin, viewer.schoolId);
    const scoped = studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"];
    feedbackQuery = feedbackQuery.eq("sender_role", "student").in("user_id", scoped);
    flagsQuery = flagsQuery.eq("sender_role", "student").in("user_id", scoped);
  }

  // Per-question circuit breaker: questions currently pulled from service, whether awaiting
  // classification (still content_status 'live' at 2+ open flags, caught by openFlags below) or
  // already classified needs_rewrite/needs_removal and waiting on admin to resolve the hold.
  // Not school-scoped -- content is shared across every school, so any reviewer with access to
  // this page sees every held question, the same reasoning behind letting school_admin trigger
  // a hold on content outside their own school in the first place.
  const heldQuestionsQuery = admin
    .from("questions")
    .select("id, subject, title, question_text, content_status, flag_classification")
    .neq("content_status", "live")
    .order("updated_at", { ascending: false });

  const [{ data: feedback }, { data: flags }, { data: heldQuestions }] = await Promise.all([
    feedbackQuery,
    flagsQuery,
    heldQuestionsQuery,
  ]);

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
        heldQuestions={heldQuestions as any}
        canResolveHolds={isAdmin(viewer.role)}
      />

      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
