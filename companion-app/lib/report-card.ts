import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/fetch-all";

// A subject only shows up as a focus area or a strength once there's enough signal to mean
// something -- a single lucky or unlucky guess shouldn't label a subject "weak." Below this
// many answered questions in a subject, it's just left out of both lists rather than shown
// with a misleading accuracy number.
export const MIN_SAMPLE_SIZE = 5;
const FOCUS_ACCURACY_CEILING = 70;
const STRENGTH_ACCURACY_FLOOR = 85;
const MAX_LIST_ITEMS = 6;

export type SubjectStat = { subject: string; answered: number; correct: number; accuracy: number; total: number };
export type CategoryStat = { category: string; answered: number; correct: number; accuracy: number; total: number };

export type ReportCard = {
  generatedAt: string;
  overall: { total: number; answered: number; correct: number; accuracy: number; percentComplete: number };
  byCategory: CategoryStat[];
  focusAreas: SubjectStat[];
  strengths: SubjectStat[];
};

// Shared by the student's own /report-card page and (later) an instructor pulling the same
// report for one of their students -- this only needs a userId, not a session, so either
// caller can supply whichever id they're allowed to see.
export async function getReportCard(supabase: SupabaseClient, userId: string): Promise<ReportCard> {
  const questions = await fetchAllRows<{ id: string; subject: string; primary_category: string }>((from, to) =>
    supabase.from("questions").select("id, subject, primary_category").order("id").range(from, to)
  );

  // Ordered oldest-first so that when multiple attempts exist for the same question (a
  // student retrying it), the later entry overwrites the earlier one in the map below --
  // the report reflects current mastery, not a permanent mark against a question they got
  // wrong once early on and have since gotten right.
  // Ordered by created_at then id -- a plain created_at order isn't guaranteed stable across
  // pages when two attempts land in the same second (same class of bug as the 1000-row cap
  // fix elsewhere: an unstable sort on a paginated query can skip or duplicate rows).
  const attempts = await fetchAllRows<{ question_id: string; correct: boolean; created_at: string }>((from, to) =>
    supabase
      .from("attempts")
      .select("question_id, correct, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );

  const latestByQuestion = new Map<string, boolean>();
  for (const a of attempts) latestByQuestion.set(a.question_id, a.correct);

  const subjectMap = new Map<string, SubjectStat>();
  const categoryMap = new Map<string, CategoryStat>();

  for (const q of questions) {
    const wasAttempted = latestByQuestion.has(q.id);
    const wasCorrect = latestByQuestion.get(q.id) === true;

    const subj = subjectMap.get(q.subject) ?? { subject: q.subject, answered: 0, correct: 0, accuracy: 0, total: 0 };
    subj.total += 1;
    if (wasAttempted) {
      subj.answered += 1;
      if (wasCorrect) subj.correct += 1;
    }
    subjectMap.set(q.subject, subj);

    const cat = categoryMap.get(q.primary_category) ?? {
      category: q.primary_category,
      answered: 0,
      correct: 0,
      accuracy: 0,
      total: 0,
    };
    cat.total += 1;
    if (wasAttempted) {
      cat.answered += 1;
      if (wasCorrect) cat.correct += 1;
    }
    categoryMap.set(q.primary_category, cat);
  }

  function withAccuracy<T extends { answered: number; correct: number }>(rows: T[]): T[] {
    return rows.map((r) => ({ ...r, accuracy: r.answered > 0 ? Math.round((r.correct / r.answered) * 100) : 0 }));
  }

  const subjects = withAccuracy(Array.from(subjectMap.values()));
  const byCategory = withAccuracy(Array.from(categoryMap.values())).sort((a, b) => b.total - a.total);

  const eligible = subjects.filter((s) => s.answered >= MIN_SAMPLE_SIZE);
  const focusAreas = eligible
    .filter((s) => s.accuracy < FOCUS_ACCURACY_CEILING)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, MAX_LIST_ITEMS);
  const strengths = eligible
    .filter((s) => s.accuracy >= STRENGTH_ACCURACY_FLOOR)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, MAX_LIST_ITEMS);

  const overallTotal = questions.length;
  const overallAnswered = questions.filter((q) => latestByQuestion.has(q.id)).length;
  const overallCorrect = questions.filter((q) => latestByQuestion.get(q.id) === true).length;

  return {
    generatedAt: new Date().toISOString(),
    overall: {
      total: overallTotal,
      answered: overallAnswered,
      correct: overallCorrect,
      accuracy: overallAnswered > 0 ? Math.round((overallCorrect / overallAnswered) * 100) : 0,
      percentComplete: overallTotal > 0 ? Math.round((overallAnswered / overallTotal) * 100) : 0,
    },
    byCategory,
    focusAreas,
    strengths,
  };
}
