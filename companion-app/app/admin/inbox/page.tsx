import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents, getSchoolUserIds } from "@/lib/roles";
import AdminInboxList from "@/components/admin-inbox-list";

export const dynamic = "force-dynamic";

export default async function AdminInbox({
  searchParams,
}: {
  searchParams: { thread?: string };
}) {
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

  // Question options come along on every query now, not just the draft/rationale text -- Brian
  // wants the full multiple-choice picture (every option, which one Claude marked correct,
  // which one the student picked) visible next to the reply he's reviewing, not just the
  // question stem. question_interactions(*) pulls every interaction on the question; raise-hand
  // is only ever raised against a single-interaction question today (same assumption the
  // raise-hand route itself makes), so withMessages below just takes interactions[0].
  //
  // Each select() string below is written out in full as one literal, not built from a shared
  // variable or template interpolation -- Supabase's TS types parse the select string at
  // compile time to infer the result shape, and anything other than one plain literal collapses
  // that inference to an untyped error type, which then fails every property access on the
  // result (this broke the ai-assist route the same way; same fix here, just duplicated instead
  // of shared).
  let openQuery = admin
    .from("raised_hands")
    .select(
      "id, created_at, claude_draft_reply, selected_option_ids, questions(subject, question_text, question_interactions(id, question_options(id, option_label, option_text, display_order), response_keys(choice_id)))"
    )
    .eq("status", "open")
    .order("created_at", { ascending: true });
  let resolvedQuery = admin
    .from("raised_hands")
    .select(
      "id, created_at, answered_at, selected_option_ids, questions(subject, question_text, question_interactions(id, question_options(id, option_label, option_text, display_order), response_keys(choice_id)))"
    )
    .eq("status", "resolved")
    .eq("archived_by_instructor", false)
    .order("answered_at", { ascending: false });
  if (studentIds) {
    openQuery = openQuery.in("user_id", noStudents ? ["00000000-0000-0000-0000-000000000000"] : studentIds);
    resolvedQuery = resolvedQuery.in("user_id", noStudents ? ["00000000-0000-0000-0000-000000000000"] : studentIds);
  }

  const [{ data: openHands }, { data: allResolvedHands }] = await Promise.all([openQuery, resolvedQuery]);

  const allIds = [
    ...(openHands ?? []).map((h: any) => h.id),
    ...(allResolvedHands ?? []).map((h: any) => h.id),
  ];

  // Tiered AI reply review (MNGT 745 Week 6 capstone): split the resolved bucket into replies
  // still waiting on their post-send review (auto-sent, high or low priority, reviewed_at still
  // null) and everything else, which behaves exactly like the Answered tab always has. A
  // resolved thread with no reply_audits row at all is a pre-capstone thread or one a human
  // approved from the hold queue -- same case as "reviewed_at not null," already settled.
  const { data: audits } =
    allIds.length > 0
      ? await admin
          .from("reply_audits")
          .select("id, raised_hand_id, tier, grounded, confidence_score, confidence_reason, reviewed_at")
          .in("raised_hand_id", allIds)
      : { data: [] as any[] };
  const auditByHandId = new Map((audits ?? []).map((a: any) => [a.raised_hand_id, a]));

  const needsReviewHands = (allResolvedHands ?? []).filter((h: any) => {
    const audit = auditByHandId.get(h.id);
    return audit && (audit.tier === "high" || audit.tier === "low") && !audit.reviewed_at;
  });
  const resolvedHands = (allResolvedHands ?? []).filter((h: any) => !needsReviewHands.includes(h));

  const { data: messages } =
    allIds.length > 0
      ? await admin
          .from("raised_hand_messages")
          .select("id, raised_hand_id, sender, sender_id, body, created_at, is_acknowledgment")
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
    return hands.map((h) => {
      const audit = auditByHandId.get(h.id);
      const interaction = (h.questions?.question_interactions ?? [])[0];
      const correctIds = new Set(
        (interaction?.response_keys ?? []).map((k: any) => k.choice_id).filter(Boolean)
      );
      const selectedIds = new Set(h.selected_option_ids ?? []);
      const options = [...(interaction?.question_options ?? [])]
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((o: any) => ({
          id: o.id,
          label: o.option_label,
          text: o.option_text,
          correct: correctIds.has(o.id),
          selected: selectedIds.has(o.id),
        }));
      return {
        id: h.id,
        subject: h.questions?.subject ?? "Question",
        questionText: h.questions?.question_text ?? "",
        options,
        claudeDraftReply: h.claude_draft_reply ?? null,
        auditId: audit?.id ?? null,
        tier: audit?.tier ?? null,
        grounded: audit?.grounded ?? null,
        confidenceScore: audit?.confidence_score ?? null,
        confidenceReason: audit?.confidence_reason ?? null,
        messages: (messages ?? [])
          .filter((m: any) => m.raised_hand_id === h.id)
          .map((m: any) => ({
            ...m,
            isAcknowledgment: m.is_acknowledgment as boolean,
            instructorName: m.sender === "instructor" && m.sender_id ? instructorNames.get(m.sender_id) ?? null : null,
          })),
      };
    });
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
        needsReviewThreads={withMessages(needsReviewHands)}
        resolvedThreads={withMessages(resolvedHands)}
        showInstructorNames={viewer.role === "admin"}
        highlightId={searchParams.thread ?? null}
      />
      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
