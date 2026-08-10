# Question format for the other AI

Give the other AI this prompt when generating practice questions. Save its output as `questions.json` (a JSON array) and hand it back here to import into Supabase.

## Prompt to give the other AI

Write NCLEX-PN style practice questions in this exact JSON structure, one object per question, in a JSON array:

```json
{
  "title": "Hand Hygiene After Body-Fluid Contact",
  "subject": "Cardiovascular",
  "primary_category": "Physiological Integrity: Physiological Adaptation",
  "secondary_category": "Cardiovascular",
  "item_type": "single_choice",
  "question_text": "A client with heart failure reports...",
  "correct_answer_rationale": "Explains only why the correct answer is correct.",
  "strategy_1_understand": "One sentence on what the question is really asking.",
  "strategy_2_clear_stem": "One sentence naming the relevant and irrelevant details in the stem only, not the answer choices.",
  "strategy_3_identify_correct": "One sentence connecting the important cues to the correct answer.",
  "strategy_4_intro": "Optional one-sentence lead-in before eliminating the wrong answers, or omit this field.",
  "framework": "Function and Purpose",
  "framework_application": "Two to three sentences teaching how to apply that framework to this question, not just naming it.",
  "source_subject_tag": "Test 14",
  "source_question_number": "42",
  "options": [
    { "label": "A", "text": "...", "is_correct": false, "rationale": "Why this specific choice is wrong." },
    { "label": "B", "text": "...", "is_correct": true, "rationale": null },
    { "label": "C", "text": "...", "is_correct": false, "rationale": "Why this specific choice is wrong." },
    { "label": "D", "text": "...", "is_correct": false, "rationale": "Why this specific choice is wrong." }
  ]
}
```

Rules:
- `subject` must be one of the exact class names in `subject_taxonomy.md`, spelled exactly as
  listed there. Don't invent a new subject name, even a close variant, the dashboard groups
  questions by exact string match. If a drug question clearly belongs to one body system, use
  that system's "Drugs for/that Affect the [System]" class from the list; only use
  `Pharmacology` or `Antibiotics` for drug questions that genuinely don't tie to one system.
- `title` and `secondary_category` are required on every question, the database rejects rows missing either.
- `title` is a short topic label shown to the student above the question. Keep it under 8 words.
- `item_type` is `single_choice` for one correct answer, `multiple_response` for traditional select-all-that-apply (any number of options can be correct, the student isn't told how many), or `select_n` for select-all-that-apply where the question tells the student exactly how many to pick. For `select_n`, don't add a separate "how many" field, the required count is derived automatically from however many options you mark `is_correct: true`. Mark every correct option `is_correct: true` for `multiple_response` and `select_n`. A `single_choice` question must have exactly one `is_correct: true` option, the importer rejects anything else.
- `primary_category` must be one of the four official NCLEX-PN Client Needs categories with subcategory: Safe and Effective Care Environment: Coordinated Care, Safe and Effective Care Environment: Safety and Infection Prevention and Control, Health Promotion and Maintenance, Psychosocial Integrity, Physiological Integrity: Basic Care and Comfort, Physiological Integrity: Pharmacological Therapies, Physiological Integrity: Reduction of Risk Potential, Physiological Integrity: Physiological Adaptation.
- `correct_answer_rationale` explains only why the correct answer (or answers) is correct. Do not explain the wrong answers here, that belongs in each option's own `rationale`.
- Every option where `is_correct` is `false` must have a `rationale` explaining specifically why that choice is wrong, the importer rejects a wrong option with no rationale. A correct option's `rationale` can be `null`. Option labels must be unique within a question (no two `A`s).
- `framework` must be one of: Function and Purpose, Expected vs Unexpected, Recognize Cues, Cause and Effect, Least Restrictive or Least Invasive, Safety and Risk Reduction, Standard Precautions, Scope of Practice, Client Rights and Autonomy, Therapeutic Communication, Nursing Process, Five Rights of Delegation, ABCs, Maslow's Hierarchy, Acute vs Chronic, Actual vs Potential, Unstable vs Stable, `null`, or `"none"`. Use `null` (or `"none"`, both work) when elimination alone settled the answer and no framework was needed. `framework`, `source_subject_tag`, and `source_question_number` are the only fields allowed to be missing, not every question uses a framework, and freshly AI-generated questions (no original source document) won't have a source tag or number.
- `framework_application` is required whenever `framework` is set to a real framework. It must teach the reasoning tool, not just restate the answer: name what question to ask using that framework, then show how asking it points to the correct choice. If `framework` is `null` or `"none"`, set `framework_application` to `null` too.
- Keep `strategy_1_understand`, `strategy_2_clear_stem`, and `strategy_3_identify_correct` to one sentence each. `framework_application` can run two to three sentences.
- No extra fields beyond what's shown above.
- This format only covers ordinary selection questions (single choice, multi-select). Case studies, matrices, cloze, bow-tie, and other next-gen NCLEX formats aren't supported by this importer yet, don't generate those.

## What to do with the output

Save the JSON array as `questions.json` and bring it back. Run `node scripts/import-questions.js questions.json` (with your Supabase env vars set) to import it, this writes one row to `questions`, one row to `question_interactions`, one row per option to `question_options`, one row per correct option to `response_keys`, and looks up `framework` and `item_type` by name automatically. The importer validates each question before inserting it (required fields present, exactly one correct answer for single_choice, every wrong option has a rationale, no duplicate labels) and prints an error naming exactly what's wrong for anything it rejects, without touching the rest of the batch. Questions that pass import already approved and published, so they appear to students right away.
