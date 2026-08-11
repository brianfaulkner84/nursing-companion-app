import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
import ResetSubjectButton from "@/components/reset-subject-button";
import ResetAllProgressButton from "@/components/reset-all-progress-button";

export default async function Progress() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const questions = await fetchAllRows((from, to) =>
    supabase.from("questions").select("id, subject").order("id").range(from, to)
  );
  const attempts = await fetchAllRows((from, to) =>
    supabase
      .from("attempts")
      .select("question_id, correct")
      .eq("user_id", user.id)
      .order("id")
      .range(from, to)
  );

  const subjects = Array.from(new Set(questions.map((q) => q.subject)));
  const attemptsByQuestion = new Map(attempts.map((a) => [a.question_id, a.correct]));

  const rows = subjects.map((subject) => {
    const ids = questions.filter((q) => q.subject === subject).map((q) => q.id);
    const attempted = ids.filter((id) => attemptsByQuestion.has(id));
    const correct = attempted.filter((id) => attemptsByQuestion.get(id)).length;
    // Mastery is against the whole subject, not just what's been attempted so far -- correct
    // divided by total questions in the subject, not correct divided by attempted. Attempted-only
    // accuracy let one lucky early answer show as "100% mastery" on a 226-question subject the
    // student had barely touched, with a fully-filled bar to match. That's a legitimate accuracy
    // number, just not what a mastery bar should mean.
    const masteryPercent = ids.length > 0 ? Math.round((correct / ids.length) * 100) : 0;
    return { subject, masteryPercent, attempted: attempted.length, total: ids.length };
  });

  return (
    <div>
      <h1>Progress</h1>
      {attemptsByQuestion.size > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <ResetAllProgressButton totalAnswered={attemptsByQuestion.size} />
        </div>
      )}
      {rows.length === 0 && <p className="muted">No questions published yet.</p>}
      {rows.map((r) => (
        <div key={r.subject} className="card" style={{ marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <span className="tile-title">
              {r.subject}: {r.masteryPercent}% mastery ({r.attempted}/{r.total} answered)
            </span>
            {r.attempted > 0 && <ResetSubjectButton subject={r.subject} />}
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${r.masteryPercent}%` }} />
          </div>
        </div>
      ))}
      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
