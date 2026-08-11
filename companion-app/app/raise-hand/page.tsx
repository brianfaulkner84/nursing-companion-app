import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchQuestionBreakdown } from "@/lib/quiz-queries";
import RaiseHandForm from "@/components/raise-hand-form";

// Server component now, not client-only: the student used to land here with nothing but a note
// box, having to remember the question, their answer, and the rationale from the screen they
// just left. This fetches the same breakdown the answer page already shows and renders it above
// the note box, so the full picture is right here while they're explaining their confusion.
export default async function RaiseHand({
  searchParams,
}: {
  searchParams: { question?: string; selected?: string; next?: string; answer?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const questionId = searchParams.question;
  const selectedParam = searchParams.selected ?? "";
  const selectedIds = selectedParam.split(",").filter(Boolean);
  if (!questionId) redirect("/dashboard");

  const breakdown = await fetchQuestionBreakdown(supabase, questionId);
  if (!breakdown) redirect("/dashboard");

  const { question, options, correctIds, frameworkName } = breakdown;
  const correctOptions = options.filter((o: any) => correctIds.has(o.id));
  const incorrectOptions = options.filter((o: any) => !correctIds.has(o.id));
  const selectedOptions = options.filter((o: any) => selectedIds.includes(o.id));

  // Same fallback logic as before: both answer-breakdown pages pass their own "next question"
  // href and their own URL back to themselves, since this page has no way to know which flow
  // (quiz vs. review session) launched it. Falls back to /dashboard if either is missing.
  const nextHref = searchParams.next || "/dashboard";
  const answerHref = searchParams.answer ?? null;

  return (
    <div>
      <h1>Raise your hand</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        This sends the question, your answer, and your note to an instructor for review. Add
        anything that would help explain your confusion, then check your Inbox in a day or two
        for a reply, nothing gets emailed.
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <p style={{ fontWeight: 600, marginBottom: "0.6rem" }}>{question.question_text}</p>
        {selectedOptions.length > 0 && (
          <p>
            <strong>Your answer:</strong>{" "}
            {selectedOptions.map((o: any) => `${o.option_label}. ${o.option_text}`).join(" / ")}
          </p>
        )}
        <p>
          <strong>Correct answer:</strong>{" "}
          {correctOptions.map((o: any) => `${o.option_label}. ${o.option_text}`).join(" / ")}
        </p>

        <details className="card-dark" style={{ marginTop: "0.75rem" }}>
          <summary>Rationale and strategy walkthrough</summary>
          <p style={{ marginTop: "0.75rem" }}>{question.correct_answer_rationale}</p>
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
      </div>

      <RaiseHandForm
        questionId={questionId}
        selected={selectedParam}
        nextHref={nextHref}
        answerHref={answerHref}
      />
    </div>
  );
}
