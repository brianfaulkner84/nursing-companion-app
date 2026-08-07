-- Nursing Companion App: Supabase schema
-- Structure: questions -> question_interactions -> question_options, with response_keys as
-- the answer key. Every question has exactly one interaction today (single_choice,
-- multiple_response, or select_n), but a question can have more than one interaction (a
-- bow-tie question would have three; a matrix question one per row) without changing this
-- schema again. See supabase/migrations for how this evolved from the original flat table.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  beta_code_used text,
  access_type text not null default 'free-trial' check (access_type in ('free-trial', 'lifetime-free', 'paid')),
  weekly_email boolean not null default true,
  created_at timestamptz not null default now()
);

-- No public select policy on beta_codes (see RLS section below). Redemption happens
-- server-side through /api/redeem-code using the service role, so the codes themselves
-- are never exposed to the browser.
create table beta_codes (
  code text primary key,
  grant_type text not null default 'lifetime-free',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into beta_codes (code, grant_type, active) values ('68C-FTW', 'lifetime-free', true);

create table critical_thinking_frameworks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true
);

insert into critical_thinking_frameworks (name, description) values
  ('Function and Purpose', 'Ask what the client wants the document, device, or action to accomplish, then match that function to the option designed to perform it.'),
  ('Expected vs Unexpected', 'Distinguish findings that are a normal, anticipated part of the client''s condition or treatment from findings that signal a new problem.'),
  ('Recognize Cues', 'Identify which details in the stem are clinically significant versus background information.'),
  ('Cause and Effect', 'Trace how one clinical finding or action directly produces another to identify the most likely explanation or outcome.'),
  ('Least Restrictive or Least Invasive', 'When multiple options could work, choose the one that preserves the most independence or does the least harm.'),
  ('Safety and Risk Reduction', 'Prioritize the option that most reduces the client''s immediate risk of harm.'),
  ('Standard Precautions', 'Treat all body fluids and contaminated surfaces as potential sources of infection, and choose the option that maintains the infection-control barrier.'),
  ('Scope of Practice', 'Match the task to the role legally and professionally allowed to perform it (LPN/VN, RN, UAP).'),
  ('Client Rights and Autonomy', 'Favor the option that best respects the client''s right to make their own informed decisions.'),
  ('Therapeutic Communication', 'Choose the response that keeps communication open, nonjudgmental, and focused on the client''s feelings.'),
  ('Nursing Process', 'Work through assess, diagnose, plan, implement, evaluate to find where the correct action fits.'),
  ('Five Rights of Delegation', 'Check the right task, circumstance, person, direction, and supervision before delegating.'),
  ('ABCs', 'Prioritize airway, breathing, and circulation problems ahead of other client needs.'),
  ('Maslow''s Hierarchy', 'Prioritize physiological and safety needs before psychosocial or higher-level needs.'),
  ('Acute vs Chronic', 'Identify whether the situation described is a sudden change or an ongoing, stable condition, and prioritize the acute one.'),
  ('Actual vs Potential', 'An existing (actual) problem generally takes priority over a possible (potential) one.'),
  ('Unstable vs Stable', 'Prioritize the client whose condition is changing or at risk over the client who is stable.');

-- Lookup table for question/interaction formats. A table instead of a check constraint so
-- registering a new format (matrix, cloze, bow-tie, ordering, ...) never requires altering
-- questions or question_interactions again.
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

-- Lookup table for specialty review tracks (Pediatrics, Pharmacology, OB/GYN, ...), not a
-- check constraint, so adding another track later doesn't require altering subjects again.
create table specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  display_order int not null default 0
);

insert into specialties (name, slug, display_order) values
  ('Pediatrics', 'pediatrics', 1),
  ('Pharmacology', 'pharmacology', 2),
  ('OB/GYN', 'ob-gyn', 3);

-- One row per distinct questions.subject value, kept in sync by the importer. specialty_id
-- starts null for a new subject; tag it with an update statement, there's no admin UI yet.
create table subjects (
  name text primary key,
  specialty_id uuid references specialties(id),
  display_order int not null default 0
);

-- framework_id, source_subject_tag, and source_question_number stay nullable on purpose.
-- Some questions genuinely use no framework (elimination alone was enough), and future
-- bank-exhaustion questions are freshly AI-drafted with no original source document to
-- cite, so neither field can be required without breaking that later feature.
create table questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  primary_category text not null check (primary_category in (
    'Safe and Effective Care Environment: Coordinated Care',
    'Safe and Effective Care Environment: Safety and Infection Prevention and Control',
    'Health Promotion and Maintenance',
    'Psychosocial Integrity',
    'Physiological Integrity: Basic Care and Comfort',
    'Physiological Integrity: Pharmacological Therapies',
    'Physiological Integrity: Reduction of Risk Potential',
    'Physiological Integrity: Physiological Adaptation'
  )),
  secondary_category text not null,
  item_type_id uuid not null references item_types(id),
  scoring_model text not null default 'zero_one' check (scoring_model in ('zero_one', 'plus_minus', 'rationale')),
  item_config jsonb not null default '{}'::jsonb,
  question_text text not null,
  correct_answer_rationale text not null,
  strategy_1_understand text not null,
  strategy_2_clear_stem text not null,
  strategy_3_identify_correct text not null,
  strategy_4_intro text,
  framework_id uuid references critical_thinking_frameworks(id),
  framework_application text,
  source_subject_tag text,
  source_question_number text,
  review_status text not null default 'draft' check (review_status in ('draft', 'review', 'approved', 'rejected')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_publish_requires_approval check (is_published = false or review_status = 'approved')
);

-- One or more interactions per question. Every question has exactly one row here today; a
-- future bow-tie question would have three, a matrix question one per row, a cloze question
-- one per blank. minimum/maximum_selections drive both UI enforcement (how many choices a
-- student can pick) and, for select_n, the "Select exactly N" prompt.
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

-- Options belong to an interaction, not directly to a question, so a multi-interaction
-- question (bow-tie, matrix) can give each part its own choice list.
create table question_options (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references question_interactions(id) on delete cascade,
  option_label text not null,
  display_order int not null,
  option_text text not null,
  option_rationale text,
  unique (interaction_id, option_label),
  unique (interaction_id, display_order)
);

-- General answer key. Not just an is_correct flag: expected_position covers ordered
-- response, expected_value covers calculations, target_key covers matrix/cloze/drag targets,
-- score_weight covers partial credit. single_choice/multiple_response/select_n questions
-- just get one row per correct choice_id with the default score_weight of 1.
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

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  interaction_id uuid references question_interactions(id) on delete cascade,
  selected_choice_ids uuid[] not null default '{}',
  correct boolean not null,
  created_at timestamptz not null default now()
);

create table raised_hands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
  strategy_snapshot text not null,
  rationale_snapshot text not null,
  student_note text,
  claude_draft_reply text,
  sent_reply text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

-- A student-built, named set of subjects ("My Exam 2 Review"). The Full/Pediatrics/
-- Pharmacology/OB-GYN quick-start buttons on the builder page don't create rows here,
-- they're computed on the fly from subjects/specialties; this table is only for sets the
-- student explicitly named and saved.
create table subject_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table subject_folder_items (
  folder_id uuid not null references subject_folders(id) on delete cascade,
  subject text not null references subjects(name) on delete cascade,
  primary key (folder_id, subject)
);

-- Keep updated_at current on every edit to a question.
-- search_path is pinned empty so the function can't be tricked by objects created
-- earlier in a mutable search_path (Supabase linter 0011_function_search_path_mutable).
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = '';

create trigger questions_set_updated_at
  before update on questions
  for each row execute function set_updated_at();

-- Foreign key indexes.
create index on question_interactions (question_id);
create index on question_options (interaction_id);
create index on response_keys (interaction_id);
create index on response_keys (choice_id);
create index on attempts (question_id);
create index on attempts (interaction_id);
create index on attempts (user_id);
create index on raised_hands (question_id);
create index on raised_hands (user_id);
create index on questions (framework_id);
create index on subjects (specialty_id);
create index on subject_folders (user_id);
create index on subject_folder_items (subject);

-- Row Level Security

alter table profiles enable row level security;
alter table beta_codes enable row level security;
alter table critical_thinking_frameworks enable row level security;
alter table item_types enable row level security;
alter table questions enable row level security;
alter table question_interactions enable row level security;
alter table question_options enable row level security;
alter table response_keys enable row level security;
alter table attempts enable row level security;
alter table raised_hands enable row level security;
alter table specialties enable row level security;
alter table subjects enable row level security;
alter table subject_folders enable row level security;
alter table subject_folder_items enable row level security;

create policy "read own profile" on profiles for select using ((select auth.uid()) = id);
create policy "update own profile" on profiles for update using ((select auth.uid()) = id);
create policy "insert own profile" on profiles for insert with check ((select auth.uid()) = id);

-- No select policy on beta_codes: RLS is enabled with zero policies, so only the
-- service role (used inside /api/redeem-code) can read it. Nothing else can list codes.

create policy "read frameworks" on critical_thinking_frameworks for select using (true);
create policy "read item types" on item_types for select using (true);

create policy "read published questions" on questions for select using (is_published = true);

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

-- response_keys is the answer key. This intentionally matches the same "readable once the
-- question is published" posture question_options already has, rather than being locked
-- down further, see the note in supabase/migrations/20260806020000_interaction_layer.sql.
create policy "read response keys for published questions" on response_keys for select using (
  exists (
    select 1 from question_interactions
    join questions on questions.id = question_interactions.question_id
    where question_interactions.id = response_keys.interaction_id
      and questions.is_published = true
  )
);

create policy "read own attempts" on attempts for select using ((select auth.uid()) = user_id);
create policy "insert own attempts" on attempts for insert with check ((select auth.uid()) = user_id);
create policy "delete own attempts" on attempts for delete using ((select auth.uid()) = user_id);

create policy "read own raised hands" on raised_hands for select using ((select auth.uid()) = user_id);
create policy "insert own raised hands" on raised_hands for insert with check ((select auth.uid()) = user_id);

create policy "read specialties" on specialties for select using (true);
create policy "read subjects" on subjects for select using (true);

create policy "read own folders" on subject_folders for select using ((select auth.uid()) = user_id);
create policy "insert own folders" on subject_folders for insert with check ((select auth.uid()) = user_id);
create policy "delete own folders" on subject_folders for delete using ((select auth.uid()) = user_id);

create policy "read own folder items" on subject_folder_items for select using (
  exists (select 1 from subject_folders where subject_folders.id = subject_folder_items.folder_id and subject_folders.user_id = (select auth.uid()))
);
create policy "insert own folder items" on subject_folder_items for insert with check (
  exists (select 1 from subject_folders where subject_folders.id = subject_folder_items.folder_id and subject_folders.user_id = (select auth.uid()))
);
create policy "delete own folder items" on subject_folder_items for delete using (
  exists (select 1 from subject_folders where subject_folders.id = subject_folder_items.folder_id and subject_folders.user_id = (select auth.uid()))
);

-- Service role (used only inside serverless functions and the import script) bypasses RLS automatically,
-- so it can read/write draft and unpublished questions, and read beta_codes.
