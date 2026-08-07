import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchNextQuestion } from "@/lib/quiz-queries";
import QuizClient from "@/components/quiz-client";

// A review session spans a resolved set of subjects, either a saved folder
// (?folder=<id>) or an ad hoc list from the exam builder's quick-start buttons or manual
// checkboxes (?subjects=a,b,c&label=...). Questions come back shuffled across the whole
// set (fetchNextQuestion with random=true), not exhausted one subject at a time.
export default async function ReviewSession({
  searchParams,
}: {
  searchParams: { folder?: string; subjects?: string; label?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  let subjects: string[] = [];
  let label = searchParams.label ?? "Review";

  if (searchParams.folder) {
    const { data: folder } = await supabase
      .from("subject_folders")
      .select("name, subject_folder_items(subject)")
      .eq("id", searchParams.folder)
      .single();
    if (!folder) redirect("/exams");
    subjects = (folder.subject_folder_items ?? []).map((i: any) => i.subject);
    label = folder.name;
  } else if (searchParams.subjects) {
    subjects = searchParams.subjects.split(",").filter(Boolean);
  }

  if (subjects.length === 0) redirect("/exams");

  const next = await fetchNextQuestion(supabase, subjects, user.id, true);
  if (!next) redirect(`/subject-complete?subject=${encodeURIComponent(label)}`);

  const returnParams = searchParams.folder
    ? `folder=${searchParams.folder}`
    : `subjects=${encodeURIComponent(subjects.join(","))}&label=${encodeURIComponent(label)}`;

  return (
    <QuizClient
      question={next.question}
      interaction={next.interaction}
      options={next.options}
      answerHref={`/review-session/answer?${returnParams}`}
    />
  );
}
