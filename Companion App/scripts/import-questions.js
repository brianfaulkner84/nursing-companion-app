// Imports questions.json into the normalized Supabase schema
// (questions, question_options, critical_thinking_frameworks).
// Usage: node scripts/import-questions.js path/to/questions.json
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-questions.js path/to/questions.json");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resolveFrameworkId(name) {
  if (!name || name === "none") return null;
  const { data, error } = await supabase
    .from("critical_thinking_frameworks")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Framework "${name}" is not in critical_thinking_frameworks. Check spelling against question_format.md.`);
  return data.id;
}

async function main() {
  const questions = JSON.parse(fs.readFileSync(file, "utf-8"));
  let imported = 0;
  let failed = 0;

  for (const q of questions) {
    try {
      const frameworkId = await resolveFrameworkId(q.framework);

      const { data: inserted, error: qError } = await supabase
        .from("questions")
        .insert({
          title: q.title ?? null,
          subject: q.subject,
          primary_category: q.primary_category,
          secondary_category: q.secondary_category ?? null,
          question_type: q.question_type ?? "single_select",
          question_text: q.question_text,
          correct_answer_rationale: q.correct_answer_rationale,
          strategy_1_understand: q.strategy_1_understand,
          strategy_2_clear_stem: q.strategy_2_clear_stem,
          strategy_3_identify_correct: q.strategy_3_identify_correct,
          strategy_4_intro: q.strategy_4_intro ?? null,
          framework_id: frameworkId,
          framework_application: q.framework_application ?? "",
          source_subject_tag: q.source_subject_tag ?? null,
          source_question_number: q.source_question_number ?? null,
          is_published: true,
        })
        .select("id")
        .single();

      if (qError) throw qError;

      const optionRows = (q.options ?? []).map((o, i) => ({
        question_id: inserted.id,
        option_label: o.label,
        display_order: i,
        option_text: o.text,
        is_correct: !!o.is_correct,
        option_rationale: o.rationale ?? null,
      }));

      const { error: oError } = await supabase.from("question_options").insert(optionRows);
      if (oError) throw oError;

      imported++;
    } catch (err) {
      failed++;
      console.error(`Failed on "${q.title ?? q.question_text?.slice(0, 40)}": ${err.message}`);
    }
  }

  console.log(`Imported ${imported} question(s). ${failed} failed.`);
}

main();
