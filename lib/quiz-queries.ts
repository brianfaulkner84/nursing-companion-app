import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/fetch-all";

// Shared between the single-subject quiz (/quiz/[subject]) and the multi-subject review
// session (/review-session), so a fix or schema change only has to happen in one place.

function pickNext(questions: any[], attemptedIds: Set<string>, random: boolean) {
  const unattempted = questions.filter((q: any) => !attemptedIds.has(q.id));
  if (unattempted.length === 0) return null;

  const next = random
    ? unattempted[Math.floor(Math.random() * unattempted.length)]
    : unattempted[0];

  // Every question has exactly one interaction today. A future bow-tie/matrix question
  // would have more than one row here, and callers would need to render each in sequence.
  const interaction = (next.question_interactions ?? [])[0];
  const options = [...(interaction?.question_options ?? [])].sort(
    (a: any, b: any) => a.display_order - b.display_order
  );

  return { question: next, interaction, options };
}

export async function fetchNextQuestion(
  supabase: SupabaseClient,
  subjects: string[],
  userId: string,
  random: boolean
) {
  const questions = await fetchAllRows((from, to) =>
    supabase
      .from("questions")
      .select("*, question_interactions(*, item_types(name), question_options(*))")
      .in("subject", subjects)
      // Per-question circuit breaker (MNGT 745 Week 6 capstone): a question pulled from
      // service by two or more open content flags stops being handed to any student until it's
      // resolved, everywhere a question gets served, not just here.
      .eq("content_status", "live")
      .order("id")
      .range(from, to)
  );

  const attempts = await fetchAllRows((from, to) =>
    supabase.from("attempts").select("question_id").eq("user_id", userId).order("id").range(from, to)
  );

  const attemptedIds = new Set(attempts.map((a: any) => a.question_id as string));
  return pickNext(questions, attemptedIds, random);
}

// Same as fetchNextQuestion, but filtered by NCLEX primary_category instead of subject, for
// the dashboard's "By NCLEX topic" browse view, which cuts across subjects.
export async function fetchNextQuestionByCategory(
  supabase: SupabaseClient,
  category: string,
  userId: string,
  random: boolean
) {
  const questions = await fetchAllRows((from, to) =>
    supabase
      .from("questions")
      .select("*, question_interactions(*, item_types(name), question_options(*))")
      .eq("primary_category", category)
      .eq("content_status", "live")
      .order("id")
      .range(from, to)
  );

  const attempts = await fetchAllRows((from, to) =>
    supabase.from("attempts").select("question_id").eq("user_id", userId).order("id").range(from, to)
  );

  const attemptedIds = new Set(attempts.map((a: any) => a.question_id as string));
  return pickNext(questions, attemptedIds, random);
}

// Same idea, filtered by item_type (single_choice, multiple_response/SATA, select_n) instead
// of subject, for the dashboard's "By question type" browse view.
export async function fetchNextQuestionByItemType(
  supabase: SupabaseClient,
  itemTypeName: string,
  userId: string,
  random: boolean
) {
  const { data: itemType } = await supabase
    .from("item_types")
    .select("id")
    .eq("name", itemTypeName)
    .single();
  if (!itemType) return null;

  const questions = await fetchAllRows((from, to) =>
    supabase
      .from("questions")
      .select("*, question_interactions(*, item_types(name), question_options(*))")
      .eq("item_type_id", itemType.id)
      .eq("content_status", "live")
      .order("id")
      .range(from, to)
  );

  const attempts = await fetchAllRows((from, to) =>
    supabase.from("attempts").select("question_id").eq("user_id", userId).order("id").range(from, to)
  );

  const attemptedIds = new Set(attempts.map((a: any) => a.question_id as string));
  return pickNext(questions, attemptedIds, random);
}

export async function fetchQuestionBreakdown(supabase: SupabaseClient, questionId: string) {
  const { data: question } = await supabase
    .from("questions")
    .select(
      "*, question_interactions(*, question_options(*), response_keys(*)), critical_thinking_frameworks(name)"
    )
    .eq("id", questionId)
    .single();
  if (!question) return null;

  const interaction = (question.question_interactions ?? [])[0];
  const options = [...(interaction?.question_options ?? [])].sort(
    (a: any, b: any) => a.display_order - b.display_order
  );
  const correctIds = new Set<string>(
    (interaction?.response_keys ?? []).map((k: any) => k.choice_id as string).filter(Boolean)
  );

  return {
    question,
    interaction,
    options,
    correctIds,
    frameworkName: question.critical_thinking_frameworks?.name as string | undefined,
  };
}
