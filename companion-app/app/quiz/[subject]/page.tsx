import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuizClient from "./quiz-client";

export default async function Quiz({ params }: { params: { subject: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const subject = decodeURIComponent(params.subject);

  const { data: questions } = await supabase
    .from("questions")
    .select("*, question_options(*)")
    .eq("subject", subject);

  const { data: attempts } = await supabase
    .from("attempts")
    .select("question_id")
    .eq("user_id", user.id);

  const attemptedIds = new Set((attempts ?? []).map((a) => a.question_id));
  const next = (questions ?? []).find((q) => !attemptedIds.has(q.id));

  if (!next) redirect(`/subject-complete?subject=${encodeURIComponent(subject)}`);

  const options = [...(next.question_options ?? [])].sort((a, b) => a.display_order - b.display_order);

  return <QuizClient question={next} options={options} subject={subject} />;
}
