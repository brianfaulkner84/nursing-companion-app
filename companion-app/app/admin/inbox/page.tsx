import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents, getSchoolUserIds } from "@/lib/roles";
import AdminInboxList from "@/components/admin-inbox-list";

export const dynamic = "force-dynamic";

export default async function AdminInbox() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const viewer = await getViewer(supabase, user);
  if (!canReviewStudents(viewer.role)) redirect("/dashboard");

  const admin = createAdminClient();

  // Admin sees every school's threads, unfiltered -- that's the oversight Brian asked for,
  // being able to see every student/instructor interaction regardless of who's handling it.
  // An instructor only sees their own school's students.
  const studentIds = viewer.role === "instructor" ? await getSchoolUserIds(admin, viewer.schoolId) : null;
  const noStudents = studentIds !== null && studentIds.length === 0;

  let openQuery = admin
    .from("raised_hands")
    .select("id, created_at, claude_draft_reply, questions(subject, question_text)")
    .eq("status", "open")
    .order("created_at", { ascending: true });
  let resolvedQuery = admin
    .from("raised_hands")
    .select("id, created_at, answered_at, questions(subject, question_text)")
    .eq("status", "resolved")
    .eq("archived_by_instructor", false)
    .order("answered_at", { ascending: false });
  if (studentIds) {
    openQuery = openQuery.in("user_id", noStudents ? ["00000000-0000-0000-0000-000000000000"] : studentIds);
    resolvedQuery = resolvedQuery.in("user_id", noStudents ? ["00000000-0000-0000-0000-000000000000"] : studentIds);
  }

  const [{ data: openHands }, { data: resolvedHands }] = await Promise.all([openQuery, resolvedQuery]);

  const allIds = [
    ...(openHands ?? []).map((h: any) => h.id),
    ...(resolvedHands ?? []).map((h: any) => h.id),
  ];

  const { data: messages } =
    allIds.length > 0
      ? await admin
          .from("raised_hand_messages")
          .select("id, raised_hand_id, sender, sender_id, body, created_at")
          .in("raised_hand_id", allIds)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

  // Admin gets to see WHICH instructor sent each reply (the auditing ask); an instructor
  // reviewing their own queue doesn't need that detail about their own replies. Only fetched
  // when there's actually an admin viewing and instructor-sent messages to label.
  const instructorSenderIds = Array.from(
    new Set((messages ?? []).filter((m: any) => m.sender === "instructor" && m.sender_id).map((m: any) => m.sender_id as string))
  );
  let instructorNames = new Map<string, string>();
  if (viewer.role === "admin" && instructorSenderIds.length > 0) {
    const { data: instructorProfiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", instructorSenderIds);
    instructorNames = new Map((instructorProfiles ?? []).map((p: any) => [p.id, p.display_name ?? "Instructor"]));
  }

  function withMessages(hands: any[]) {
    return hands.map((h) => ({
      id: h.id,
      subject: h.questions?.subject ?? "Question",
      questionText: h.questions?.question_text ?? "",
      claudeDraftReply: h.claude_draft_reply ?? null,
      messages: (messages ?? [])
        .filter((m: any) => m.raised_hand_id === h.id)
        .map((m: any) => ({
          ...m,
          instructorName: m.sender === "instructor" && m.sender_id ? instructorNames.get(m.sender_id) ?? null : null,
        })),
    }));
  }

  return (
    <div>
      <h1>Review inbox</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Replies go straight to the student&apos;s own Inbox, no email involved. A thread
        reopens here automatically if the student replies again after you&apos;ve answered it.
        {viewer.role === "admin" && " As admin, this shows every school's threads, not just your own replies."}
      </p>
      <AdminInboxList
        openThreads={withMessages(openHands ?? [])}
        resolvedThreads={withMessages(resolvedHands ?? [])}
        showInstructorNames={viewer.role === "admin"}
      />
      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
