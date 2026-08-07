import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import AdminInboxList from "@/components/admin-inbox-list";

export const dynamic = "force-dynamic";

export default async function AdminInbox() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: openHands } = await admin
    .from("raised_hands")
    .select("id, created_at, claude_draft_reply, questions(subject, question_text)")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  const { data: resolvedHands } = await admin
    .from("raised_hands")
    .select("id, created_at, answered_at, questions(subject, question_text)")
    .eq("status", "resolved")
    .eq("archived_by_instructor", false)
    .order("answered_at", { ascending: false });

  const allIds = [
    ...(openHands ?? []).map((h: any) => h.id),
    ...(resolvedHands ?? []).map((h: any) => h.id),
  ];

  const { data: messages } =
    allIds.length > 0
      ? await admin
          .from("raised_hand_messages")
          .select("id, raised_hand_id, sender, body, created_at")
          .in("raised_hand_id", allIds)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

  function withMessages(hands: any[]) {
    return hands.map((h) => ({
      id: h.id,
      subject: h.questions?.subject ?? "Question",
      questionText: h.questions?.question_text ?? "",
      claudeDraftReply: h.claude_draft_reply ?? null,
      messages: (messages ?? []).filter((m: any) => m.raised_hand_id === h.id),
    }));
  }

  return (
    <div>
      <h1>Review inbox</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Replies go straight to the student&apos;s own Inbox, no email involved. A thread
        reopens here automatically if the student replies again after you&apos;ve answered it.
      </p>
      <AdminInboxList
        openThreads={withMessages(openHands ?? [])}
        resolvedThreads={withMessages(resolvedHands ?? [])}
      />
      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
