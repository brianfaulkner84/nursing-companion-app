import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Progress() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: questions } = await supabase.from("questions").select("id, subject");
  const { data: attempts } = await supabase
    .from("attempts")
    .select("question_id, correct")
    .eq("user_id", user.id);

  const subjects = Array.from(new Set((questions ?? []).map((q) => q.subject)));
  const attemptsByQuestion = new Map((attempts ?? []).map((a) => [a.question_id, a.correct]));

  const rows = subjects.map((subject) => {
    const ids = (questions ?? []).filter((q) => q.subject === subject).map((q) => q.id);
    const attempted = ids.filter((id) => attemptsByQuestion.has(id));
    const correct = attempted.filter((id) => attemptsByQuestion.get(id)).length;
    const masteryPercent = attempted.length > 0 ? Math.round((correct / attempted.length) * 100) : 0;
    return { subject, masteryPercent, attempted: attempted.length, total: ids.length };
  });

  return (
    <div>
      <h1>Progress</h1>
      {rows.map((r) => (
        <div key={r.subject} style={{ marginBottom: "0.75rem" }}>
          <div>{r.subject}: {r.masteryPercent}% mastery ({r.attempted}/{r.total} answered)</div>
          <div style={{ background: "#eee", height: 8, borderRadius: 4 }}>
            <div style={{ background: "#666", height: 8, borderRadius: 4, width: `${r.masteryPercent}%` }} />
          </div>
        </div>
      ))}
      <Link href="/dashboard">Back to dashboard</Link>
    </div>
  );
}
