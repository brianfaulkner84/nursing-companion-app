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
  const { data: hands } = await admin
    .from("raised_hands")
    .select("id, student_note, claude_draft_reply, created_at, questions(subject, question_text)")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  const rows = (hands ?? []).map((h: any) => ({
    id: h.id,
    student_note: h.student_note,
    claude_draft_reply: h.claude_draft_reply,
    created_at: h.created_at,
    subject: h.questions?.subject ?? "Question",
    question_text: h.questions?.question_text ?? "",
  }));

  return (
    <div>
      <h1>Review inbox</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Open raised hands, oldest first. Edit Claude&apos;s draft as needed before sending, it
        goes straight to the student&apos;s own Inbox, no email involved.
      </p>
      <AdminInboxList initialHands={rows} />
      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
