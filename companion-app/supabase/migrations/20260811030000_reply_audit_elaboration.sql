-- A third outcome alongside clean/corrected in the Sent, Needs Review queue: the AI's answer
-- was accurate, but the instructor wants to add more for the student. Kept separate from
-- correction_text/corrected_by (which mean "the AI's answer was wrong, here's the fix") so the
-- audit trail can tell "clean, nothing added," "clean, instructor added context," and "wrong,
-- here's the correction" apart. Elaborating still counts as clean for the category trust ladder
-- -- see the outcome === "corrected" check in lib/tier.ts's nextCategoryTier caller.

alter table reply_audits add column if not exists was_elaborated boolean not null default false;
alter table reply_audits add column if not exists elaboration_text text;
alter table reply_audits add column if not exists elaborated_by uuid references auth.users(id);
