import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/fetch-all";

// A subject counts as "thin" once it has fewer than this many published questions. Set once
// here so the header badge and /admin/content-gaps always agree on the same number.
export const THIN_TOPIC_THRESHOLD = 5;

export type ThinTopic = { subject: string; count: number; moduleName: string };

export async function getThinTopics(admin: SupabaseClient): Promise<ThinTopic[]> {
  const questions = await fetchAllRows((from, to) =>
    admin.from("questions").select("id, subject").order("id").range(from, to)
  );
  const counts = new Map<string, number>();
  for (const q of questions) {
    counts.set(q.subject, (counts.get(q.subject) ?? 0) + 1);
  }

  const { data: subjectRows } = await admin.from("subjects").select("name, modules(name)");
  const moduleByName = new Map(
    (subjectRows ?? []).map((s: any) => [s.name, s.modules?.name ?? "Other"])
  );

  return Array.from(counts.entries())
    .filter(([, count]) => count < THIN_TOPIC_THRESHOLD)
    .map(([subject, count]) => ({
      subject,
      count,
      moduleName: moduleByName.get(subject) ?? "Other",
    }))
    .sort((a, b) => a.count - b.count);
}
