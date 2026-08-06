import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Review() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, question_id, selected_option_ids, correct, created_at, questions(subject, title, question_text)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1>Review your answers</h1>
      {(attempts ?? []).length === 0 && <p>You haven&apos;t answered any questions yet.</p>}
      {(attempts ?? []).map((a: any) => (
        <Link
          key={a.id}
          href={`/quiz/${encodeURIComponent(a.questions.subject)}/answer?question=${a.question_id}&selected=${(a.selected_option_ids ?? []).join(",")}`}
          style={{
            display: "block",
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: "0.75rem",
            marginBottom: "0.5rem",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>
            {a.questions.subject} &middot; {a.correct ? "Correct" : "Not quite"}
          </div>
          <div>{a.questions.title || a.questions.question_text}</div>
        </Link>
      ))}
      <Link href="/dashboard">Back to dashboard</Link>
    </div>
  );
}
