import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchQuestionBreakdown } from "@/lib/quiz-queries";

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

  const breakdown = await fetchQuestionBreakdown(supabase, questionId);
  if (!breakdown) redirect(`/quiz/${encodeURIComponent(subject)}`);

  const { question, options, correctIds, frameworkName } = breakdown;
  const correctOptions = options.filter((o: any) => correctIds.has(o.id));
  const incorrectOptions = options.filter((o: any) => !correctIds.has(o.id));
  const selected = options.filter((o: any) => selectedIds.includes(o.id));

  const correctIdList = [...correctIds].sort();
  const chosenIds = [...selectedIds].sort();
  const correct =
    correctIdList.length === chosenIds.length &&
    correctIdList.every((id: string, i: number) => id === chosenIds[i]);

  return (
    <div>
      <div className={`banner ${correct ? "banner-correct" : "banner-incorrect"}`}>
        {correct ? "Correct" : "Not quite"}
      </div>

      <p><strong>Your answer:</strong> {selected.map((o: any) => `${o.option_label}. ${o.option_text}`).join(" / ")}</p>
      <p><strong>Correct answer:</strong> {correctOptions.map((o: any) => `${o.option_label}. ${o.option_text}`).join(" / ")}</p>

      <h3>Correct-answer rationale</h3>
      <p>{question.correct_answer_rationale}</p>

      <details className="card-dark" style={{ marginTop: "1rem" }}>
        <summary>LPN Launchpad 5-Step Strategy</summary>
        <ol style={{ marginTop: "0.75rem", paddingLeft: "1.1rem" }}>
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

      <div className="btn-row" style={{ marginTop: "1rem" }}>
        <Link href={`/quiz/${encodeURIComponent(subject)}`} className="btn btn-primary">Next question</Link>
        <Link href={`/raise-hand?question=${question.id}&selected=${selectedIds.join(",")}`} className="btn btn-secondary">
          Raise your hand
        </Link>
      </div>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        Still confused? Raise your hand and an instructor will send you a personalized reply in
        your <Link href="/inbox">Inbox</Link>.
      </p>
    </div>
  );
}
