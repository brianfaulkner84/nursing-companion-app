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

function validate(q) {
  const problems = [];

  if (!q.title) problems.push("missing title");
  if (!q.secondary_category) problems.push("missing secondary_category");

  const options = q.options ?? [];
  const labels = options.map((o) => o.label);
  const uniqueLabels = new Set(labels);
  if (uniqueLabels.size !== labels.length) problems.push("duplicate option labels");

  const correctCount = options.filter((o) => o.is_correct).length;
  if (correctCount === 0) problems.push("no option marked is_correct");
  if (q.question_type !== "multiple_select" && correctCount > 1) {
    problems.push(`single_select question has ${correctCount} correct options`);
  }

  for (const o of options) {
    if (!o.is_correct && !o.rationale) {
      problems.push(`option ${o.label} is incorrect but has no rationale`);
    }
  }

  const hasFramework = q.framework && q.framework !== "none";
  if (hasFramework && !q.framework_application) {
    problems.push("framework is set but framework_application is missing");
  }

  return problems;
}

async function main() {
  const questions = JSON.parse(fs.readFileSync(file, "utf-8"));
  let imported = 0;
  let failed = 0;

  for (const q of questions) {
    const label = q.title ?? q.question_text?.slice(0, 40) ?? "(untitled)";
    let insertedId = null;
    try {
      const problems = validate(q);
      if (problems.length > 0) {
        throw new Error(problems.join("; "));
      }

      const frameworkId = await resolveFrameworkId(q.framework);

      // Insert unpublished first. Only flip is_published to true once the full option
      // set has been written successfully, so a failure partway through never leaves a
      // published question with missing or incomplete answer choices visible to students.
      const { data: inserted, error: qError } = await supabase
        .from("questions")
        .insert({
          title: q.title,
          subject: q.subject,
          primary_category: q.primary_category,
          secondary_category: q.secondary_category,
          question_type: q.question_type ?? "single_select",
          question_text: q.question_text,
          correct_answer_rationale: q.correct_answer_rationale,
          strategy_1_understand: q.strategy_1_understand,
          strategy_2_clear_stem: q.strategy_2_clear_stem,
          strategy_3_identify_correct: q.strategy_3_identify_correct,
          strategy_4_intro: q.strategy_4_intro ?? null,
          framework_id: frameworkId,
          framework_application: q.framework_application ?? null,
          source_subject_tag: q.source_subject_tag ?? null,
          source_question_number: q.source_question_number ?? null,
          review_status: "approved",
          is_published: false,
        })
        .select("id")
        .single();

      if (qError) throw qError;
      insertedId = inserted.id;

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

      const { error: publishError } = await supabase
        .from("questions")
        .update({ is_published: true })
        .eq("id", inserted.id);
      if (publishError) throw publishError;

      imported++;
    } catch (err) {
      failed++;
      console.error(`Failed on "${label}": ${err.message}`);
      if (insertedId) {
        // Clean up the orphaned question row so failed imports don't leave dangling drafts.
        await supabase.from("questions").delete().eq("id", insertedId);
      }
    }
  }

  console.log(`Imported ${imported} question(s). ${failed} failed.`);
}

main();
