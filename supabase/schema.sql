-- Nursing Companion App: Supabase schema
-- Structure: questions -> question_interactions -> question_options, with response_keys as
-- the answer key. Every question has exactly one interaction today (single_choice,
-- multiple_response, or select_n), but a question can have more than one interaction (a
-- bow-tie question would have three; a matrix question one per row) without changing this
-- schema again. See supabase/migrations for how this evolved from the original flat table.

-- The school a profile belongs to. Only one row exists today (seeded below); this exists so
-- retrofitting multi-school support later doesn't mean a risky migration on live student data.
-- access_expires_at is a package expiration (e.g. end of semester): hasAccess() checks it on
-- every access-gated page load, so access ends automatically the moment it passes, no daily
-- job needed. archived_at is a manual override for "this ends now regardless of any date" --
-- a school that stops paying mid-semester. Neither ever deletes data.
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  access_expires_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

insert into schools (name) values ('LPN Launchpad');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  beta_code_used text,
  access_type text not null default 'free-trial' check (access_type in ('free-trial', 'lifetime-free', 'paid')),
  weekly_email boolean not null default true,
  -- 'school_admin' is scaffolded (valid value, nothing grants or checks it yet) -- an
  -- instructor with elevated permissions scoped to their own school only, as opposed to
  -- 'admin' which is global. See migration 20260807100000_add_school_admin_role.sql.
  role text not null default 'student' check (role in ('student', 'instructor', 'school_admin', 'admin')),
  school_id uuid references schools(id),
  -- Manual per-person archive, independent of school-level archiving: pulling one student or
  -- instructor (removed from the organization, redeemed the wrong code) without archiving
  -- their whole school. Locks them out, keeps their data.
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- SECURITY: role, school_id, access_type, beta_code_used, and archived_at must only ever
-- change through a service-role write (redeem-code, or a future admin promote-user route).
-- Without this, the "update own profile" RLS policy below -- which is correctly scoped to
-- "own row" but has no column restriction -- would let a signed-in user grant themselves
-- instructor/admin or paid access by patching their own profile row directly from the
-- browser, or un-archive themselves after being locked out. auth.role() reflects the
-- request's JWT role claim: 'service_role' for service-key requests, 'authenticated' for an
-- ordinary signed-in user.
create or replace function prevent_self_privilege_escalation()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.school_id is distinct from old.school_id
    or new.access_type is distinct from old.access_type
    or new.beta_code_used is distinct from old.beta_code_used
    or new.archived_at is distinct from old.archived_at
  then
    raise exception 'role, school_id, access_type, beta_code_used, and archived_at can only be changed by the service role';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger profiles_prevent_self_privilege_escalation
before update on profiles
for each row execute function prevent_self_privilege_escalation();

-- This is a trigger function, never meant to be called directly, but Supabase auto-exposes
-- every public-schema function as a /rest/v1/rpc/<name> endpoint. It doesn't need security
-- definer (only reads NEW/OLD and calls the already-schema-qualified auth.role()), and
-- revoking direct EXECUTE closes it off from anon/authenticated without affecting the
-- trigger itself -- Postgres doesn't gate a trigger firing behind the same EXECUTE check it
-- uses for a direct call. See migration 20260807110000_fix_privilege_escalation_trigger_exposure.sql.
revoke execute on function prevent_self_privilege_escalation() from anon, authenticated;

-- Stripe-sourced subscription detail. profiles.access_type stays the simple gate pages
-- check ('free-trial' | 'lifetime-free' | 'paid'); this table holds the actual status,
-- current period, and price behind that flag. Writes only ever happen through
-- /api/stripe-webhook using the service role, since only Stripe's own signed events should
-- change subscription state.
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  status text not null default 'incomplete' check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'
  )),
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- No public select policy on beta_codes (see RLS section below). Redemption happens
-- server-side through /api/redeem-code using the service role, so the codes themselves
-- are never exposed to the browser.
create table beta_codes (
  code text primary key,
  grant_type text not null default 'lifetime-free',
  active boolean not null default true,
  -- Which role and school this code grants on redemption. A school buying in generates its
  -- own batch of student codes and (usually one or two) instructor codes against its own
  -- school_id; a school-level package/expiration can layer on top of this later without
  -- another schema change. 'school_admin' is scaffolded here too (see profiles.role above)
  -- but nothing generates or redeems such a code yet. 'admin' deliberately isn't allowed --
  -- global admin stays a manual, trusted action, never something distributable by code.
  role text not null default 'student' check (role in ('student', 'instructor', 'school_admin')),
  school_id uuid references schools(id),
  created_at timestamptz not null default now()
);

insert into beta_codes (code, grant_type, active, role, school_id)
values ('68C-FTW', 'lifetime-free', true, 'student', (select id from schools limit 1));

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

-- Groups the 21 modules down to a shorter list of top-level dashboard buttons. Most modules
-- stand alone; a handful of numbered parts of the same topic (Pediatrics I-IV, the two
-- Cardiovascular modules, ...) collapse into one button that then splits back out.
create table module_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order int not null default 0
);

insert into module_groups (name, display_order) values
  ('Fundamentals of Nursing', 1),
  ('Cardiovascular', 11),
  ('Maternity and Newborn Care', 15),
  ('Pediatrics', 18);

-- Course modules, for the "By module" dashboard browse view. Named and ordered directly
-- from the table of contents of the 8 LPN Launchpad study books (Exam 11 through Exam 31),
-- so the grouping matches what the student already sees in their course materials. group_id
-- is nullable: an unassigned module still displays as its own standalone button.
create table modules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  group_id uuid references module_groups(id),
  display_order int not null default 0
);

insert into modules (name, display_order) values
  ('Fundamentals of Nursing', 1),
  ('Introduction to Nursing Interventions', 2),
  ('Fundamentals of Clinical Practice', 3),
  ('Nursing Across the Lifespan', 4),
  ('Mental Health Nursing', 5),
  ('Surgical Nursing and the Musculoskeletal System', 6),
  ('Integumentary and Gastrointestinal Nursing', 7),
  ('The Urinary System', 8),
  ('Blood, Lymphatic, and Immune Systems', 9),
  ('The Respiratory System', 10),
  ('Cardiovascular System I', 11),
  ('Cardiovascular System II', 12),
  ('Disorders of the Endocrine System', 13),
  ('The Nervous System', 14),
  ('Reproductive Health Nursing', 15),
  ('Nursing Care During Labor and Birth', 16),
  ('Nursing Care During the Postpartum Period', 17),
  ('Care of the Pediatric Patient I', 18),
  ('Care of the Pediatric Patient II', 19),
  ('Care of the Pediatric Patient III', 20),
  ('Care of the Pediatric Patient IV', 21),
  -- Not from a book table of contents like the rest: catches drug-class subjects
  -- (Antibiotics, Anticoagulants, ...) that cut across body systems rather than
  -- belonging to one chapter. See 20260806100000_backfill_and_tag_remaining_subjects.sql.
  ('Pharmacology', 22);

update modules set group_id = (select id from module_groups where name = 'Fundamentals of Nursing')
where name in ('Fundamentals of Nursing', 'Introduction to Nursing Interventions', 'Fundamentals of Clinical Practice');

update modules set group_id = (select id from module_groups where name = 'Cardiovascular')
where name in ('Cardiovascular System I', 'Cardiovascular System II');

update modules set group_id = (select id from module_groups where name = 'Maternity and Newborn Care')
where name in ('Reproductive Health Nursing', 'Nursing Care During Labor and Birth', 'Nursing Care During the Postpartum Period');

update modules set group_id = (select id from module_groups where name = 'Pediatrics')
where name in ('Care of the Pediatric Patient I', 'Care of the Pediatric Patient II', 'Care of the Pediatric Patient III', 'Care of the Pediatric Patient IV');

-- One row per distinct questions.subject value, kept in sync by the importer. specialty_id
-- and module_id start null for a new subject; tag them with an update statement, there's no
-- admin UI yet (see supabase/migrations/20260806070000_tag_subjects_with_modules.sql).
create table subjects (
  name text primary key,
  specialty_id uuid references specialties(id),
  module_id uuid references modules(id),
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
  -- Per-question circuit breaker (tiered AI reply review, MNGT 745 Week 6 capstone): once a
  -- question crosses two open question_flags it flips away from 'live' and stops being served
  -- anywhere until resolved. flag_classification records how a reviewer classified the flag;
  -- only admin can actually resolve a hold, enforced in the API route, not in SQL.
  content_status text not null default 'live'
    check (content_status in ('live', 'needs_rewrite', 'needs_removal')),
  flag_classification text check (flag_classification in ('accurate', 'needs_rewrite', 'needs_removal')),
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
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  archived_by_instructor boolean not null default false,
  archived_by_student boolean not null default false,
  -- Set when a student flags an AI-auto-sent reply as wrong via "Flag This Reply." Null means
  -- not escalated. Only meaningful on a thread whose reply was auto-sent (tier high/low in
  -- reply_audits) -- a held reply already requires a human before it ever reaches the student,
  -- so there's nothing for the student to escalate on that path.
  escalated_at timestamptz
);

-- The ongoing back-and-forth on a raised hand. user_id is always the STUDENT's id, even on
-- instructor messages, so one RLS policy covers reading every message in a student's own
-- thread. All writes go through service-role API routes.
create table raised_hand_messages (
  id uuid primary key default gen_random_uuid(),
  raised_hand_id uuid not null references raised_hands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('student', 'instructor')),
  -- The actual author's id, distinct from user_id (which is always the student's, see above).
  -- Null for student messages (user_id already says who), set to the replying instructor's id
  -- for instructor messages -- lets admin see which instructor handled which thread once more
  -- than one instructor exists.
  sender_id uuid references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- General in-app feedback (usability, bugs, suggestions) from a beta tester. No email
-- collected, ties only to auth.users(id), same privacy posture as raised_hands.
create table app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'general' check (category in ('general', 'bug', 'suggestion')),
  body text not null,
  status text not null default 'new' check (status in ('new', 'reviewed')),
  -- Feedback escalates exactly one level: a student's submission is visible to instructors
  -- and admin, an instructor's submission is visible to admin only. Captured from the
  -- submitter's profiles.role at insert time.
  sender_role text not null default 'student' check (sender_role in ('student', 'instructor')),
  created_at timestamptz not null default now()
);

-- A student flagging a specific question's content (wrong answer key, unclear wording, a
-- rationale that doesn't match the question) as opposed to Raise Your Hand, which is a
-- student's own confusion about material they otherwise trust. Separate from raised_hands so
-- the two review queues don't mix a content-QA task in with a "reply to this student" task.
create table question_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  sender_role text not null default 'student' check (sender_role in ('student', 'instructor')),
  created_at timestamptz not null default now()
);

-- Tiered AI reply review (MNGT 745 Week 6 capstone). One row per AI-drafted raised-hand reply.
-- subject is denormalized from questions.subject at write time, the same snapshot pattern
-- raised_hands already uses for strategy/rationale, so the category trust ladder below can roll
-- up by subject without joining back through questions on every read. Internal audit data,
-- never meant for a student's own view and not queried directly by instructors either -- every
-- read and write goes through a service-role API route.
create table reply_audits (
  id uuid primary key default gen_random_uuid(),
  raised_hand_id uuid not null references raised_hands(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  subject text not null,
  tier text not null check (tier in ('hold', 'high', 'low')),
  grounded boolean not null,
  confidence_score smallint not null check (confidence_score between 1 and 5),
  confidence_reason text not null,
  was_corrected boolean not null default false,
  correction_text text,
  corrected_by uuid references auth.users(id),
  -- Null until admin marks this sent reply as clean or corrects it, from the Sent, Needs Review
  -- queue. That single action both clears the item from the queue and drives the category trust
  -- ladder update. Always null for a hold-tier row, since those go through the ordinary
  -- approve-and-send flow instead, not this queue.
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- One row per subject. Starts empty; every subject defaults to hold (see the tier-decision
-- logic in /api/raise-hand) until it earns its way down through consecutive clean reviews.
create table category_trust (
  subject text primary key,
  consecutive_clean_count integer not null default 0,
  current_tier text not null default 'hold' check (current_tier in ('hold', 'high', 'low')),
  updated_at timestamptz not null default now()
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
create index on raised_hand_messages (raised_hand_id);
create index on raised_hand_messages (user_id);
create index on questions (framework_id);
create index on subjects (specialty_id);
create index on subjects (module_id);
create index on modules (group_id);
create index on subject_folders (user_id);
create index on subject_folder_items (subject);
create index on subscriptions (stripe_customer_id);
create index on profiles (school_id);
create index on profiles (archived_at);
create index on raised_hand_messages (sender_id);
create index on app_feedback (sender_role);
create index on question_flags (sender_role);
create index on schools (access_expires_at);
create index on schools (archived_at);
create index on reply_audits (question_id);
create index on reply_audits (subject);
create index on reply_audits (reviewed_at);
create index on questions (content_status);

create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

-- Row Level Security

alter table schools enable row level security;
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
alter table raised_hand_messages enable row level security;
alter table specialties enable row level security;
alter table module_groups enable row level security;
alter table modules enable row level security;
alter table subjects enable row level security;
alter table subject_folders enable row level security;
alter table subject_folder_items enable row level security;
alter table subscriptions enable row level security;
alter table reply_audits enable row level security;
alter table category_trust enable row level security;

create policy "read schools" on schools for select using (true);

create policy "read own profile" on profiles for select using ((select auth.uid()) = id);
-- Column-level protection for role/school_id/access_type/beta_code_used is enforced by the
-- prevent_self_privilege_escalation trigger above, not by this policy -- RLS "using" only
-- controls which ROWS a policy applies to, not which columns, so it can't by itself stop a
-- user from patching their own row's role to 'admin'.
create policy "update own profile" on profiles for update using ((select auth.uid()) = id);
create policy "insert own profile" on profiles for insert with check ((select auth.uid()) = id);

-- No select policy on beta_codes: RLS is enabled with zero policies, so only the
-- service role (used inside /api/redeem-code) can read it. Nothing else can list codes.
-- reply_audits and category_trust use the same lockout: no policies at all, service-role only,
-- since this is internal audit data no student or instructor client should query directly.

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
create policy "read own thread messages" on raised_hand_messages for select using ((select auth.uid()) = user_id);

create policy "read specialties" on specialties for select using (true);
create policy "read module groups" on module_groups for select using (true);
create policy "read modules" on modules for select using (true);
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

create policy "read own subscription" on subscriptions for select using ((select auth.uid()) = user_id);

-- Service role (used only inside serverless functions and the import script) bypasses RLS automatically,
-- so it can read/write draft and unpublished questions, and read beta_codes.
