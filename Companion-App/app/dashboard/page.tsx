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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", margin: "1rem 0" }}>
        {bySubject.map((s) => (
          <Link
            key={s.subject}
            href={`/quiz/${encodeURIComponent(s.subject)}`}
            style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0.75rem", textDecoration: "none", color: "inherit" }}
          >
            <div>{s.subject}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{s.percent}% complete</div>
          </Link>
        ))}
      </div>
      <Link href="/progress">
        <button style={{ width: "100%", padding: "0.75rem" }}>View progress</button>
      </Link>
    </div>
  );
}
