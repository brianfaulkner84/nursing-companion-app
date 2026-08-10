import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAccess } from "@/lib/access";
import { fetchAllRows } from "@/lib/fetch-all";
import DashboardBrowser from "@/components/dashboard-browser";

// Without this, Next.js can cache the Supabase fetch responses (subjects/modules in
// particular) at the Data Cache layer and keep serving a stale snapshot from whenever the
// route was first hit after deploy, even though the page itself re-renders per request. That
// produced a real bug: tagging subjects in Supabase had no visible effect on this dashboard
// until a redeploy. force-dynamic guarantees every request refetches everything.
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await hasAccess(supabase, user.id))) redirect("/subscribe");

  const allQuestions = await fetchAllRows((from, to) =>
    supabase
      .from("questions")
      .select("id, subject, primary_category, item_types(name)")
      // Keep these counts matching what fetchNextQuestion* in lib/quiz-queries.ts can actually
      // serve -- a question held by the per-question circuit breaker shouldn't be counted here
      // either, or the tile would promise more questions than a student can actually reach.
      .eq("content_status", "live")
      .order("id")
      .range(from, to)
  );
  const { data: subjectRows } = await supabase
    .from("subjects")
    .select("name, module_id, modules(name, display_order, group_id, module_groups(name, display_order))");
  const attempts = await fetchAllRows((from, to) =>
    supabase
      .from("attempts")
      .select("question_id, correct")
      .eq("user_id", user.id)
      .order("id")
      .range(from, to)
  );

  const attemptedIds = new Set(attempts.map((a) => a.question_id));

  const subjectNames = Array.from(new Set(allQuestions.map((q) => q.subject)));
  type ModuleInfo = {
    name: string;
    display_order: number;
    group_id: string | null;
    module_groups: { name: string; display_order: number } | null;
  };
  const moduleBySubject = new Map(
    (subjectRows ?? []).map((s: any) => [s.name, s.modules as ModuleInfo | null])
  );

  const bySubject = subjectNames.map((subject) => {
    const subjectQuestions = allQuestions.filter((q) => q.subject === subject);
    const answered = subjectQuestions.filter((q) => attemptedIds.has(q.id)).length;
    const total = subjectQuestions.length;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    const mod = moduleBySubject.get(subject) ?? null;
    return {
      subject,
      answered,
      total,
      percent,
      moduleName: mod?.name ?? "Other",
      moduleOrder: mod?.display_order ?? 999,
      groupName: mod?.module_groups?.name ?? null,
      groupOrder: mod?.module_groups?.display_order ?? mod?.display_order ?? 999,
    };
  });

  const moduleMap = new Map<string, { name: string; order: number; groupName: string | null; groupOrder: number; subjects: typeof bySubject; total: number; answered: number }>();
  for (const s of bySubject) {
    const entry = moduleMap.get(s.moduleName) ?? {
      name: s.moduleName,
      order: s.moduleOrder,
      groupName: s.groupName,
      groupOrder: s.groupOrder,
      subjects: [],
      total: 0,
      answered: 0,
    };
    entry.subjects.push(s);
    entry.total += s.total;
    entry.answered += s.answered;
    moduleMap.set(s.moduleName, entry);
  }
  const modulesFlat = Array.from(moduleMap.values())
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      name: m.name,
      subjects: m.subjects,
      total: m.total,
      answered: m.answered,
      percent: m.total > 0 ? Math.round((m.answered / m.total) * 100) : 0,
    }));

  // Group modules under their module_group where one exists; a module with no group
  // becomes a single-module "group" of its own, so the dashboard can decide to skip the
  // extra click when there's nothing to split out.
  const groupMap = new Map<string, { name: string; order: number; modules: typeof modulesFlat }>();
  for (const m of Array.from(moduleMap.values())) {
    const key = m.groupName ?? `__solo__${m.name}`;
    const entry = groupMap.get(key) ?? { name: m.groupName ?? m.name, order: m.groupOrder, modules: [] };
    entry.modules.push(modulesFlat.find((mf) => mf.name === m.name)!);
    groupMap.set(key, entry);
  }
  const byGroup = Array.from(groupMap.values())
    .sort((a, b) => a.order - b.order)
    .map((g) => {
      const total = g.modules.reduce((sum, m) => sum + m.total, 0);
      const answered = g.modules.reduce((sum, m) => sum + m.answered, 0);
      return {
        name: g.name,
        modules: g.modules,
        total,
        answered,
        percent: total > 0 ? Math.round((answered / total) * 100) : 0,
      };
    });

  const categoryMap = new Map<string, { total: number; answered: number }>();
  for (const q of allQuestions) {
    const entry = categoryMap.get(q.primary_category) ?? { total: 0, answered: 0 };
    entry.total += 1;
    if (attemptedIds.has(q.id)) entry.answered += 1;
    categoryMap.set(q.primary_category, entry);
  }
  const byCategory = Array.from(categoryMap.entries()).map(([category, v]) => ({
    category,
    total: v.total,
    answered: v.answered,
    percent: v.total > 0 ? Math.round((v.answered / v.total) * 100) : 0,
  }));

  const itemTypeLabels: Record<string, string> = {
    single_choice: "Multiple choice",
    multiple_response: "Select all that apply (SATA)",
    select_n: "Select a specific number",
  };
  const itemTypeMap = new Map<string, { total: number; answered: number }>();
  for (const q of allQuestions as any[]) {
    const name = q.item_types?.name;
    if (!name) continue;
    const entry = itemTypeMap.get(name) ?? { total: 0, answered: 0 };
    entry.total += 1;
    if (attemptedIds.has(q.id)) entry.answered += 1;
    itemTypeMap.set(name, entry);
  }
  const byItemType = Array.from(itemTypeMap.entries()).map(([itemType, v]) => ({
    itemType,
    label: itemTypeLabels[itemType] ?? itemType,
    total: v.total,
    answered: v.answered,
    percent: v.total > 0 ? Math.round((v.answered / v.total) * 100) : 0,
  }));

  const overallTotal = allQuestions.length;
  const overallAnswered = allQuestions.filter((q) => attemptedIds.has(q.id)).length;

  return (
    <DashboardBrowser
      byGroup={byGroup}
      byCategory={byCategory}
      byItemType={byItemType}
      overallTotal={overallTotal}
      overallAnswered={overallAnswered}
    />
  );
}
