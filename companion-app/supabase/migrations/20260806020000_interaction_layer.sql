-- Migration: interaction layer for future NCLEX-PN item formats (matrix, cloze, bow-tie,
-- case studies, etc.) without redesigning the schema again. Question authoring for now still
-- only uses single_choice, multiple_response, and select_n; the rest of the 2026 NCLEX-PN
-- item-format catalog can be added later purely as new item_types rows plus new interaction
-- renderers, with no further table changes required.
--
-- Safe to run as-is: as of this migration, questions/question_options/attempts are empty
-- (no batch has been imported yet), so no data backfill is needed. This is not a
-- drop-everything migration, every statement below either adds a column/table or replaces
-- a policy definition; nothing here deletes rows.

-- 1. Lookup table for question/interaction formats. A table instead of a check constraint
--    so registering a new format (matrix, cloze, bow-tie, ...) never requires altering
--    questions or question_interactions again.
create table item_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true
);

insert into item_types (name, description) values
  ('single_choice', 'Exactly one correct option from a set of choices.'),
  ('multiple_response', 'One or more correct options from a set of choices (select all that apply).'),
  ('select_n', 'An exact number of correct options from a set of choices, the count is derived from the answer key.');

-- 2. questions: drop the old two-value check constraint in favor of item_type_id, and add
--    fields the interaction layer and future scoring/case-study work will need.
alter table questions drop column question_type;
alter table questions add column item_type_id uuid references item_types(id);
update questions set item_type_id = (select id from item_types where name = 'single_choice') where item_type_id is null;
alter table questions alter column item_type_id set not null;
alter table questions add column scoring_model text not null default 'zero_one' check (scoring_model in ('zero_one', 'plus_minus', 'rationale'));
alter table questions add column item_config jsonb not null default '{}'::jsonb;

-- 3. One or more interactions per question. Every question has exactly one row here for
--    now; a future bow-tie question would have three, a matrix question one per row, etc.
create table question_interactions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  item_type_id uuid not null references item_types(id),
  prompt text,
  display_order int not null default 0,
  minimum_selections int not null default 1,
  maximum_selections int not null default 1,
  interaction_config jsonb not null default '{}'::jsonb,
  unique (question_id, display_order)
);

create index on question_interactions (question_id);

-- 4. question_options now belong to an interaction, not directly to a question, so a
--    multi-interaction question (bow-tie, matrix) can give each part its own choice list.
--    Dropping question_id also drops its two old unique constraints automatically, but the
--    existing select policy references question_id directly, so it has to be dropped first
--    or Postgres won't let the column go.
drop policy "read options for published questions" on question_options;
alter table question_options add column interaction_id uuid references question_interactions(id) on delete cascade;
alter table question_options drop column question_id;
alter table question_options alter column interaction_id set not null;
alter table question_options add constraint question_options_interaction_label_key unique (interaction_id, option_label);
alter table question_options add constraint question_options_interaction_order_key unique (interaction_id, display_order);

-- 5. Replace is_correct with a general answer-key table. is_correct can't express expected
--    order, matrix cells, numeric tolerances, or dependent rationale combinations; response_keys
--    can, and single_choice/multiple_response/select_n questions just get one row per correct choice.
alter table question_options drop column is_correct;

create table response_keys (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references question_interactions(id) on delete cascade,
  choice_id uuid references question_options(id) on delete cascade,
  expected_position int,
  expected_value text,
  target_key text,
  score_weight numeric not null default 1,
  rationale text
);

create index on response_keys (interaction_id);
create index on response_keys (choice_id);

-- 6. attempts: keep question_id (dashboard/review still join on it directly), add
--    interaction_id for later, and rename selected_option_ids to match "choice"
--    terminology now used throughout the interaction layer.
alter table attempts add column interaction_id uuid references question_interactions(id) on delete cascade;
alter table attempts rename column selected_option_ids to selected_choice_ids;
create index on attempts (interaction_id);

-- 7. RLS: new tables, and question_options' policy has to be rewritten since it can no
--    longer reference question_id directly.
alter table item_types enable row level security;
alter table question_interactions enable row level security;
alter table response_keys enable row level security;

create policy "read item types" on item_types for select using (true);

create policy "read interactions for published questions" on question_interactions for select using (
  exists (select 1 from questions where questions.id = question_interactions.question_id and questions.is_published = true)
);

create policy "read options for published questions" on question_options for select using (
  exists (
    select 1 from question_interactions
    join questions on questions.id = question_interactions.question_id
    where question_interactions.id = question_options.interaction_id
      and questions.is_published = true
  )
);

-- response_keys is the answer key. This keeps the same "readable once the question is
-- published" posture question_options already had (the app already sent option data to the
-- browser before the student answered, is_correct included, so this isn't a new exposure,
-- just the same one moved to a new table). Locking this down further so the browser
-- genuinely can't see the key before submission would need server-only fetching everywhere
-- the key is used, which is a bigger change than this migration, flagging it rather than
-- quietly doing it. The quiz screen itself has been changed to stop fetching response_keys
-- at all (it only needs question_options), so casual exposure through the normal app flow
-- is already reduced even though the table remains queryable directly with the anon key.
create policy "read response keys for published questions" on response_keys for select using (
  exists (
    select 1 from question_interactions
    join questions on questions.id = question_interactions.question_id
    where question_interactions.id = response_keys.interaction_id
      and questions.is_published = true
  )
);
