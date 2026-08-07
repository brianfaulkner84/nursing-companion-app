import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchNextQuestion } from "@/lib/quiz-queries";
import { hasAccess } from "@/lib/access";
import QuizClient from "@/components/quiz-client";

export default async function Quiz({ params }: { params: { subject: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await hasAccess(supabase, user.id))) redirect("/subscribe");

  const subject = decodeURIComponent(params.subject);

  // Single-subject quiz: always the first unattempted question, not shuffled. The
  // multi-subject review session (/review-session) uses the same helper with random=true.
  const next = await fetchNextQuestion(supabase, [subject], user.id, false);
  if (!next) redirect(`/subject-complete?subject=${encodeURIComponent(subject)}`);

  return (
    <QuizClient
      question={next.question}
      interaction={next.interaction}
      options={next.options}
      answerHref={`/quiz/${encodeURIComponent(subject)}/answer`}
    />
  );
}
