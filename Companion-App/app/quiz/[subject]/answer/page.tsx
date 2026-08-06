import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AnswerBreakdown({
  params,
  searchParams,
}: {
  params: { subject: string };
  searchParams: { question?: string; selected?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const subject = decodeURIComponent(params.subject);
  const questionId = searchParams.question;
  const selected = searchParams.selected;
  if (!questionId || !selected) redirect(`/quiz/${encodeURIComponent(subject)}`);

  const { data: question } = await supabase.from("questions").select("*").eq("id", questionId).single();
  if (!question) redirect(`/quiz/${encodeURIComponent(subject)}`);

  const correct = selected === question.correct_option;

  return (
    <div>
      <h1>{correct ? "Correct" : "Not quite"}</h1>

      <h3>5-step strategy</h3>
      <ol>
        <li>{question.strategy_1_understand}</li>
        <li>{question.strategy_2_remove_distractors}</li>
        <li>{question.strategy_3_identify_correct}</li>
        <li>{question.strategy_4_eliminate_incorrect}</li>
        {question.strategy_5_framework !== "none" && <li>Framework: {question.strategy_5_framework}</li>}
      </ol>

      <h3>Rationale</h3>
      <p>{question.rationale}</p>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <Link href={`/quiz/${encodeURIComponent(subject)}`} style={{ flex: 1 }}>
          <button style={{ width: "100%", padding: "0.75rem" }}>Next question</button>
        </Link>
        <Link
          href={`/raise-hand?question=${question.id}&selected=${selected}`}
          style={{ flex: 1 }}
        >
          <button style={{ width: "100%", padding: "0.75rem" }}>Raise your hand</button>
        </Link>
      </div>
    </div>
  );
}
