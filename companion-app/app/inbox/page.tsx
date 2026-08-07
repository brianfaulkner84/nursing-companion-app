import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default async function Inbox() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: hands } = await supabase
    .from("raised_hands")
    .select("id, student_note, sent_reply, status, created_at, answered_at, questions(subject, question_text)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = hands ?? [];

  return (
    <div>
      <h1>Inbox</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Every question you&apos;ve raised your hand on, and the instructor&apos;s reply once it&apos;s
        ready. Nothing here goes to email, check back on this page.
      </p>

      {rows.length === 0 && (
        <p className="muted">
          Nothing here yet. When you raise your hand on a question, it&apos;ll show up on this page.
        </p>
      )}

      <div className="tile-stack">
        {rows.map((h: any) => (
          <div key={h.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span className="tile-title">{h.questions?.subject ?? "Question"}</span>
              <span className={`status-badge ${h.status === "resolved" ? "status-badge-answered" : "status-badge-open"}`}>
                {h.status === "resolved" ? "Answered" : "Waiting for a reply"}
              </span>
            </div>
            <p className="tile-meta" style={{ marginBottom: "0.5rem" }}>Raised {timeAgo(h.created_at)}</p>
            {h.student_note && (
              <p style={{ marginBottom: "0.5rem" }}>
                <strong>Your note:</strong> {h.student_note}
              </p>
            )}
            {h.status === "resolved" ? (
              <div className="card-dark" style={{ marginTop: "0.5rem" }}>
                <p style={{ marginBottom: "0.3rem", color: "var(--gold-100)", fontWeight: 600 }}>
                  Instructor reply{h.answered_at ? ` · ${timeAgo(h.answered_at)}` : ""}
                </p>
                <p style={{ margin: 0 }}>{h.sent_reply}</p>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                An instructor will review this and reply here, usually within a day or two.
              </p>
            )}
          </div>
        ))}
      </div>

      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
