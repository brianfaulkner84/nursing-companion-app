import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import InboxThreadList from "@/components/inbox-thread-list";

export const dynamic = "force-dynamic";

export default async function Inbox() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Deliberately no embedded questions(subject) join here. questions has an RLS policy scoped
  // to is_published = true -- if a thread's question is a draft (unpublished, still being
  // written), Supabase's embed can't satisfy RLS on that side and silently drops the whole
  // raised_hands row from the result, not just the subject. A student's own thread should never
  // disappear from their own inbox because of the underlying question's publish state, so the
  // subject is looked up separately below and merged in JS; a question that fails that lookup
  // just falls back to "Question" instead of erasing the thread.
  // Logged, not silently swallowed: a genuine query failure (RLS denial, transient error, a
  // typo in a column name) and "you really have zero threads" both render as an empty array if
  // the error is discarded, and they need different explanations to the student and different
  // next steps for debugging. If this ever fires, the actual Postgres/PostgREST error message
  // lands in Vercel's Runtime Logs for this route.
  const { data: hands, error: handsError } = await supabase
    .from("raised_hands")
    .select("id, status, created_at, archived_by_student, escalated_at, question_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (handsError) {
    console.error("[/inbox] failed to load raised_hands:", handsError);
  }

  const questionIds = Array.from(new Set((hands ?? []).map((h: any) => h.question_id).filter(Boolean)));
  const { data: questionRows } =
    questionIds.length > 0
      ? await supabase.from("questions").select("id, subject").in("id", questionIds)
      : { data: [] as any[] };
  const subjectByQuestionId = new Map((questionRows ?? []).map((q: any) => [q.id, q.subject]));

  const handIds = (hands ?? []).map((h: any) => h.id);
  const { data: messages } =
    handIds.length > 0
      ? await supabase
          .from("raised_hand_messages")
          .select("id, raised_hand_id, sender, sender_id, body, created_at, is_acknowledgment, is_checkin, reaction")
          .in("raised_hand_id", handIds)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

  // Tell the student apart a reply from their own school's instructor versus LPN Launchpad in
  // general (AI auto-sent replies, the hold acknowledgment, or an admin/instructor answering
  // outside their own school -- admin can answer any school's threads). profiles RLS only lets a
  // user read their own row, so looking up another sender's school_id needs the admin client;
  // everything else on this page stays on the regular RLS-scoped client.
  const { data: myProfile } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
  const admin = createAdminClient();
  const senderIds = Array.from(
    new Set((messages ?? []).filter((m: any) => m.sender === "instructor" && m.sender_id).map((m: any) => m.sender_id as string))
  );
  const { data: senderProfiles } =
    senderIds.length > 0 ? await admin.from("profiles").select("id, school_id").in("id", senderIds) : { data: [] as any[] };
  const schoolIdBySenderId = new Map((senderProfiles ?? []).map((p: any) => [p.id, p.school_id]));

  function instructorLabel(m: any): string {
    if (!m.sender_id) return "LPN Launchpad Instructor";
    const senderSchoolId = schoolIdBySenderId.get(m.sender_id);
    return senderSchoolId && myProfile?.school_id && senderSchoolId === myProfile.school_id
      ? "Instructor"
      : "LPN Launchpad Instructor";
  }

  const threads = (hands ?? []).map((h: any) => ({
    id: h.id,
    subject: subjectByQuestionId.get(h.question_id) ?? "Question",
    status: h.status as "open" | "resolved",
    createdAt: h.created_at,
    archived: h.archived_by_student as boolean,
    escalatedAt: h.escalated_at as string | null,
    messages: (messages ?? [])
      .filter((m: any) => m.raised_hand_id === h.id)
      .map((m: any) => ({
        ...m,
        isAcknowledgment: m.is_acknowledgment as boolean,
        isCheckin: m.is_checkin as boolean,
        reaction: m.reaction as "up" | "down" | null,
        instructorLabel: m.sender === "instructor" ? instructorLabel(m) : null,
      })),
  }));

  return (
    <div>
      <h1>Inbox</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Every question you&apos;ve raised your hand on. Reply to keep the conversation going,
        an instructor usually gets back to you in 1 to 2 days. Nothing here goes to email.
      </p>

      {handsError ? (
        <p className="error-text">
          Something went wrong loading your inbox. Try refreshing; if it keeps happening, let an
          instructor know.
        </p>
      ) : (
        threads.length === 0 && (
          <p className="muted">
            Nothing here yet. When you raise your hand on a question, it&apos;ll show up on this page.
          </p>
        )
      )}

      <InboxThreadList threads={threads} />

      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
