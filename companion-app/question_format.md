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
  "question_type": "single_select",
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
- `title` is a short topic label shown to the student above the question. Keep it under 8 words.
- `question_type` is `single_select` for one correct answer, or `multiple_select` for select-all-that-apply. Mark every correct option `is_correct: true` when using `multiple_select`.
- `primary_category` must be one of the four official NCLEX-PN Client Needs categories with subcategory: Safe and Effective Care Environment: Coordinated Care, Safe and Effective Care Environment: Safety and Infection Control, Health Promotion and Maintenance, Psychosocial Integrity, Physiological Integrity: Basic Care and Comfort, Physiological Integrity: Pharmacological Therapies, Physiological Integrity: Reduction of Risk Potential, Physiological Integrity: Physiological Adaptation.
- `correct_answer_rationale` explains only why the correct answer (or answers) is correct. Do not explain the wrong answers here, that belongs in each option's own `rationale`.
- Every option where `is_correct` is `false` must have a `rationale` explaining specifically why that choice is wrong. A correct option's `rationale` can be `null`.
- `framework` must be one of: Function and Purpose, Expected vs Unexpected, Recognize Cues, Cause and Effect, Least Restrictive or Least Invasive, Safety and Risk Reduction, Standard Precautions, Scope of Practice, Client Rights and Autonomy, Therapeutic Communication, Nursing Process, Five Rights of Delegation, ABCs, Maslow's Hierarchy, Acute vs Chronic, Actual vs Potential, Unstable vs Stable, or "none".
- `framework_application` is required whenever `framework` isn't "none". It must teach the reasoning tool, not just restate the answer: name what question to ask using that framework, then show how asking it points to the correct choice. If `framework` is "none", set this to an empty string.
- Keep `strategy_1_understand`, `strategy_2_clear_stem`, and `strategy_3_identify_correct` to one sentence each. `framework_application` can run two to three sentences.
- No extra fields beyond what's shown above.

## What to do with the output

Save the JSON array as `questions.json` and bring it back. Run `node scripts/import-questions.js questions.json` (with your Supabase env vars set) to import it, this writes one row to `questions` and one row per option to `question_options`, and looks up `framework` by name in `critical_thinking_frameworks` automatically. Questions import as published by default and appear to students right away, note if you want draft-and-review instead.
