import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchNextQuestion, fetchNextQuestionByCategory, fetchNextQuestionByItemType } from "@/lib/quiz-queries";
import { hasAccess } from "@/lib/access";
import QuizClient from "@/components/quiz-client";

// A review session spans a resolved set of subjects, either a saved folder
// (?folder=<id>), an ad hoc list from the exam builder's quick-start buttons or manual
// checkboxes (?subjects=a,b,c&label=...), an NCLEX topic that cuts across subjects
// (?category=...&label=...), or a question type that also cuts across subjects
// (?itemType=...&label=...) from the dashboard's browse tabs. Subject-based sessions come
// back shuffled across the whole set (fetchNextQuestion with random=true), not exhausted
// one subject at a time; category/itemType sessions use the analogous helpers.
export default async function ReviewSession({
  searchParams,
}: {
  searchParams: { folder?: string; subjects?: string; category?: string; itemType?: string; label?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await hasAccess(supabase, user.id))) redirect("/subscribe");

  const label = searchParams.label ?? "Review";

  if (searchParams.category) {
    const category = searchParams.category;
    const next = await fetchNextQuestionByCategory(supabase, category, user.id, true);
    if (!next) redirect(`/subject-complete?subject=${encodeURIComponent(label)}`);

    const returnParams = `category=${encodeURIComponent(category)}&label=${encodeURIComponent(label)}`;
    return (
      <QuizClient
        question={next.question}
        interaction={next.interaction}
        options={next.options}
        answerHref={`/review-session/answer?${returnParams}`}
      />
    );
  }

  if (searchParams.itemType) {
    const itemType = searchParams.itemType;
    const next = await fetchNextQuestionByItemType(supabase, itemType, user.id, true);
    if (!next) redirect(`/subject-complete?subject=${encodeURIComponent(label)}`);

    const returnParams = `itemType=${encodeURIComponent(itemType)}&label=${encodeURIComponent(label)}`;
    return (
      <QuizClient
        question={next.question}
        interaction={next.interaction}
        options={next.options}
        answerHref={`/review-session/answer?${returnParams}`}
      />
    );
  }

  let subjects: string[] = [];
  let subjectLabel = label;

  if (searchParams.folder) {
    const { data: folder } = await supabase
      .from("subject_folders")
      .select("name, subject_folder_items(subject)")
      .eq("id", searchParams.folder)
      .single();
    if (!folder) redirect("/exams");
    subjects = (folder.subject_folder_items ?? []).map((i: any) => i.subject);
    subjectLabel = folder.name;
  } else if (searchParams.subjects) {
    subjects = searchParams.subjects.split(",").filter(Boolean);
  }

  if (subjects.length === 0) redirect("/exams");

  const next = await fetchNextQuestion(supabase, subjects, user.id, true);
  if (!next) redirect(`/subject-complete?subject=${encodeURIComponent(subjectLabel)}`);

  const returnParams = searchParams.folder
    ? `folder=${searchParams.folder}`
    : `subjects=${encodeURIComponent(subjects.join(","))}&label=${encodeURIComponent(subjectLabel)}`;

  return (
    <QuizClient
      question={next.question}
      interaction={next.interaction}
      options={next.options}
      answerHref={`/review-session/answer?${returnParams}`}
    />
  );
}
