import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Review() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, question_id, selected_choice_ids, correct, created_at, questions(subject, title, question_text)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1>Review your answers</h1>
      {(attempts ?? []).length === 0 && <p className="muted">You haven&apos;t answered any questions yet.</p>}
      {(attempts ?? []).map((a: any) => (
        <Link
          key={a.id}
          href={`/quiz/${encodeURIComponent(a.questions.subject)}/answer?question=${a.question_id}&selected=${(a.selected_choice_ids ?? []).join(",")}`}
          className="tile"
          style={{ display: "block", marginBottom: "0.5rem" }}
        >
          <div className="tile-meta">
            {a.questions.subject} ·{" "}
            <span style={{ color: a.correct ? "var(--gold-600)" : "var(--wine-600)", fontWeight: 600 }}>
              {a.correct ? "Correct" : "Not quite"}
            </span>
          </div>
          <div className="tile-title">{a.questions.title || a.questions.question_text}</div>
        </Link>
      ))}
      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
