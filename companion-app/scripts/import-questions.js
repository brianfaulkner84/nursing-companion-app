// Imports questions.json into the normalized Supabase schema
// (questions -> question_interactions -> question_options, with response_keys as the
// answer key, and critical_thinking_frameworks/item_types as lookups).
// Usage: node scripts/import-questions.js path/to/questions.json
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
//
// This importer only builds single-interaction questions using item_type single_choice,
// multiple_response, or select_n. The schema supports multi-interaction questions (bow-tie,
// matrix, cloze, case studies) for later; this script doesn't build those yet.

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

const VALID_ITEM_TYPES = ["single_choice", "multiple_response", "select_n"];

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

async function resolveItemTypeId(name) {
  const { data, error } = await supabase
    .from("item_types")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`item_type "${name}" is not in item_types. Must be one of ${VALID_ITEM_TYPES.join(", ")}.`);
  return data.id;
}

// Registers the subject in the subjects table if it's new, so it shows up as a checkbox on
// the exam builder page (/exams). specialty_id starts null, tag it later with an update
// statement, there's no admin UI for this yet.
async function ensureSubject(name) {
  if (!name) return;
  const { error } = await supabase.from("subjects").insert({ name }).select().maybeSingle();
  if (error && error.code !== "23505") throw error; // 23505 = already exists, fine
}

function validate(q) {
  const problems = [];

  if (!q.title) problems.push("missing title");
  if (!q.secondary_category) problems.push("missing secondary_category");

  if (!VALID_ITEM_TYPES.includes(q.item_type)) {
    problems.push(`item_type must be one of ${VALID_ITEM_TYPES.join(", ")}`);
  }

  const options = q.options ?? [];
  const labels = options.map((o) => o.label);
  const uniqueLabels = new Set(labels);
  if (uniqueLabels.size !== labels.length) problems.push("duplicate option labels");

  const correctCount = options.filter((o) => o.is_correct).length;
  if (correctCount === 0) problems.push("no option marked is_correct");
  if (q.item_type === "single_choice" && correctCount > 1) {
    problems.push(`single_choice question has ${correctCount} correct options`);
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
      const itemTypeId = await resolveItemTypeId(q.item_type);
      await ensureSubject(q.subject);

      // Insert unpublished first. Only flip is_published to true once the interaction,
      // options, and answer key have all been written successfully, so a failure partway
      // through never leaves a published question with a broken or missing quiz screen.
      const { data: inserted, error: qError } = await supabase
        .from("questions")
        .insert({
          title: q.title,
          subject: q.subject,
          primary_category: q.primary_category,
          secondary_category: q.secondary_category,
          item_type_id: itemTypeId,
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

      const options = q.options ?? [];
      const correctCount = options.filter((o) => o.is_correct).length;
      // select_n's required count is derived from however many options are marked correct,
      // so question_format.md doesn't need a separate "how many" field to keep in sync.
      const minSelections = q.item_type === "single_choice" ? 1 : q.item_type === "select_n" ? correctCount : 1;
      const maxSelections =
        q.item_type === "single_choice" ? 1 : q.item_type === "select_n" ? correctCount : options.length;

      const { data: interaction, error: iError } = await supabase
        .from("question_interactions")
        .insert({
          question_id: inserted.id,
          item_type_id: itemTypeId,
          display_order: 0,
          minimum_selections: minSelections,
          maximum_selections: maxSelections,
        })
        .select("id")
        .single();
      if (iError) throw iError;

      const optionRows = options.map((o, i) => ({
        interaction_id: interaction.id,
        option_label: o.label,
        display_order: i,
        option_text: o.text,
        option_rationale: o.rationale ?? null,
      }));

      const { data: insertedOptions, error: oError } = await supabase
        .from("question_options")
        .insert(optionRows)
        .select("id, option_label");
      if (oError) throw oError;

      const labelToId = Object.fromEntries(insertedOptions.map((o) => [o.option_label, o.id]));
      const keyRows = options
        .filter((o) => o.is_correct)
        .map((o) => ({ interaction_id: interaction.id, choice_id: labelToId[o.label], score_weight: 1 }));

      const { error: kError } = await supabase.from("response_keys").insert(keyRows);
      if (kError) throw kError;

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
        // Clean up the orphaned question row (cascades to its interaction, options, and
        // response keys) so failed imports don't leave dangling drafts.
        await supabase.from("questions").delete().eq("id", insertedId);
      }
    }
  }

  console.log(`Imported ${imported} question(s). ${failed} failed.`);
}

main();
