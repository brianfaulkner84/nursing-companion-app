# Question format for the other AI

Give the other AI this prompt when generating practice questions. Save its output as `questions.json` (a JSON array) and hand it back here to import into Supabase.

## Prompt to give the other AI

Write NCLEX-PN style practice questions in this exact JSON structure, one object per question, in a JSON array:

```json
{
  "subject": "Cardiovascular",
  "primary_category": "Physiological Integrity: Physiological Adaptation",
  "secondary_category": "Cardiovascular",
  "question_text": "A client with heart failure reports...",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_option": "B",
  "strategy_1_understand": "One sentence on what the question is really asking.",
  "strategy_2_remove_distractors": "One sentence naming the distracting details in the stem to set aside.",
  "strategy_3_identify_correct": "One sentence on the answer you'd pick and why.",
  "strategy_4_eliminate_incorrect": "One sentence eliminating the other three choices, one at a time.",
  "strategy_5_framework": "ABCs",
  "rationale": "The fuller explanation, same as your existing study guide rationale style.",
  "source_subject_tag": "Test 14"
}
```

Rules:
- `correct_option` is one of A, B, C, D.
- `primary_category` must be one of the four official NCLEX-PN Client Needs categories with subcategory: Safe and Effective Care Environment: Coordinated Care, Safe and Effective Care Environment: Safety and Infection Control, Health Promotion and Maintenance, Psychosocial Integrity, Physiological Integrity: Basic Care and Comfort, Physiological Integrity: Pharmacological Therapies, Physiological Integrity: Reduction of Risk Potential, Physiological Integrity: Physiological Adaptation.
- `strategy_5_framework` must be one of: ABCs, Maslow's Hierarchy, Acute vs Chronic, Actual vs Potential, Unstable vs Stable, Five Rights of Delegation, or none.
- Keep each strategy field to one sentence.
- No extra fields beyond what's shown above.

## What to do with the output

Save the JSON array as `questions.json` and bring it back. It gets imported straight into the `questions` table (see `supabase/schema.sql` in this project) with `created_date` and `id` filled in automatically on import.
