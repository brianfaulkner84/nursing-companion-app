import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InboxThreadList from "@/components/inbox-thread-list";

export const dynamic = "force-dynamic";

export default async function Inbox() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: hands } = await supabase
    .from("raised_hands")
    .select("id, status, created_at, archived_by_student, escalated_at, questions(subject)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const handIds = (hands ?? []).map((h: any) => h.id);
  const { data: messages } =
    handIds.length > 0
      ? await supabase
          .from("raised_hand_messages")
          .select("id, raised_hand_id, sender, sender_id, body, created_at")
          .in("raised_hand_id", handIds)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

  const threads = (hands ?? []).map((h: any) => ({
    id: h.id,
    subject: h.questions?.subject ?? "Question",
    status: h.status as "open" | "resolved",
    createdAt: h.created_at,
    archived: h.archived_by_student as boolean,
    escalatedAt: h.escalated_at as string | null,
    messages: (messages ?? []).filter((m: any) => m.raised_hand_id === h.id),
  }));

  return (
    <div>
      <h1>Inbox</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Every question you&apos;ve raised your hand on. Reply to keep the conversation going,
        an instructor usually gets back to you in 1 to 2 days. Nothing here goes to email.
      </p>

      {threads.length === 0 && (
        <p className="muted">
          Nothing here yet. When you raise your hand on a question, it&apos;ll show up on this page.
        </p>
      )}

      <InboxThreadList threads={threads} />

      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
