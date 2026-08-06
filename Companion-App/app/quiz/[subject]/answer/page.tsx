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
  const optionText: Record<string, string> = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
  };

  return (
    <div>
      <h1>{correct ? "Correct" : "Not quite"}</h1>

      <p>Your answer: {selected}. {optionText[selected as string]}</p>
      <p>Correct answer: {question.correct_option}. {optionText[question.correct_option]}</p>

      <h3>Rationale</h3>
      <p>{question.rationale}</p>

      <details style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0.75rem", marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>LPN Launchpad 5-Step Strategy</summary>
        <ol style={{ marginTop: "0.75rem" }}>
          <li>Understand the question: {question.strategy_1_understand}</li>
          <li>Clear the stem: {question.strategy_2_remove_distractors}</li>
          <li>Identify the correct answer: {question.strategy_3_identify_correct}</li>
          <li>Eliminate the incorrect answers: {question.strategy_4_eliminate_incorrect}</li>
          {question.strategy_5_framework !== "none" && (
            <li>
              Apply a critical-thinking framework: {question.strategy_5_framework}
              <br />
              {question.strategy_5_framework_application}
            </li>
          )}
        </ol>
      </details>

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
