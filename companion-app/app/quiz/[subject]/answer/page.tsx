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
  const selectedIds = (searchParams.selected ?? "").split(",").filter(Boolean);
  if (!questionId || selectedIds.length === 0) redirect(`/quiz/${encodeURIComponent(subject)}`);

  const { data: question } = await supabase
    .from("questions")
    .select("*, question_options(*), critical_thinking_frameworks(name)")
    .eq("id", questionId)
    .single();
  if (!question) redirect(`/quiz/${encodeURIComponent(subject)}`);

  const options = [...(question.question_options ?? [])].sort((a: any, b: any) => a.display_order - b.display_order);
  const correctOptions = options.filter((o: any) => o.is_correct);
  const incorrectOptions = options.filter((o: any) => !o.is_correct);
  const selected = options.filter((o: any) => selectedIds.includes(o.id));

  const correctIds = correctOptions.map((o: any) => o.id).sort();
  const chosenIds = [...selectedIds].sort();
  const correct = correctIds.length === chosenIds.length && correctIds.every((id: string, i: number) => id === chosenIds[i]);

  const frameworkName = question.critical_thinking_frameworks?.name;

  return (
    <div>
      <h1>{correct ? "Correct" : "Not quite"}</h1>

      <p>Your answer: {selected.map((o: any) => `${o.option_label}. ${o.option_text}`).join(" / ")}</p>
      <p>Correct answer: {correctOptions.map((o: any) => `${o.option_label}. ${o.option_text}`).join(" / ")}</p>

      <h3>Correct-answer rationale</h3>
      <p>{question.correct_answer_rationale}</p>

      <details style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0.75rem", marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>LPN Launchpad 5-Step Strategy</summary>
        <ol style={{ marginTop: "0.75rem" }}>
          <li>Understand the question: {question.strategy_1_understand}</li>
          <li>Clear the stem: {question.strategy_2_clear_stem}</li>
          <li>Identify the correct answer: {question.strategy_3_identify_correct}</li>
          <li>
            Eliminate the incorrect answers{question.strategy_4_intro ? `: ${question.strategy_4_intro}` : ""}
            <ul>
              {incorrectOptions.map((o: any) => (
                <li key={o.id}>
                  {o.option_label}: {o.option_rationale}
                </li>
              ))}
            </ul>
          </li>
          {frameworkName && (
            <li>
              Apply a critical-thinking framework: {frameworkName}
              <br />
              {question.framework_application}
            </li>
          )}
        </ol>
      </details>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <Link href={`/quiz/${encodeURIComponent(subject)}`} style={{ flex: 1 }}>
          <button style={{ width: "100%", padding: "0.75rem" }}>Next question</button>
        </Link>
        <Link
          href={`/raise-hand?question=${question.id}&selected=${selectedIds.join(",")}`}
          style={{ flex: 1 }}
        >
          <button style={{ width: "100%", padding: "0.75rem" }}>Raise your hand</button>
        </Link>
      </div>
    </div>
  );
}
