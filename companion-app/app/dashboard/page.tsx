import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: questions } = await supabase.from("questions").select("id, subject");
  const { data: attempts } = await supabase
    .from("attempts")
    .select("question_id, correct")
    .eq("user_id", user.id);

  const subjects = Array.from(new Set((questions ?? []).map((q) => q.subject)));
  const attemptedIds = new Set((attempts ?? []).map((a) => a.question_id));

  const bySubject = subjects.map((subject) => {
    const subjectQuestions = (questions ?? []).filter((q) => q.subject === subject);
    const answered = subjectQuestions.filter((q) => attemptedIds.has(q.id)).length;
    const total = subjectQuestions.length;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { subject, answered, total, percent };
  });

  return (
    <div>
      <h1>Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", margin: "1rem 0 1.5rem" }}>
        {bySubject.map((s) => (
          <Link key={s.subject} href={`/quiz/${encodeURIComponent(s.subject)}`} className="tile">
            <div className="tile-title">{s.subject}</div>
            <div className="progress-track" style={{ margin: "0.5rem 0 0.3rem" }}>
              <div className="progress-fill" style={{ width: `${s.percent}%` }} />
            </div>
            <div className="tile-meta">{s.percent}% complete</div>
          </Link>
        ))}
        {bySubject.length === 0 && (
          <p className="muted" style={{ gridColumn: "1 / -1" }}>
            No questions published yet. Check back soon.
          </p>
        )}
      </div>
      <div className="btn-row">
        <Link href="/progress" className="btn btn-secondary">View progress</Link>
        <Link href="/review" className="btn btn-secondary">Review answers</Link>
      </div>
      <Link href="/exams" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
        Build a review
      </Link>
    </div>
  );
}
