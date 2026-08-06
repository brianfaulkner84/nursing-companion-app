-- Nursing Companion App: Supabase schema
-- Normalized structure: questions / question_options / critical_thinking_frameworks.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  beta_code_used text,
  access_type text not null default 'free-trial' check (access_type in ('free-trial', 'lifetime-free', 'paid')),
  weekly_email boolean not null default true,
  created_at timestamptz not null default now()
);

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

create table questions (
  id uuid primary key default gen_random_uuid(),
  title text,
  subject text not null,
  primary_category text not null check (primary_category in (
    'Safe and Effective Care Environment: Coordinated Care',
    'Safe and Effective Care Environment: Safety and Infection Control',
    'Health Promotion and Maintenance',
    'Psychosocial Integrity',
    'Physiological Integrity: Basic Care and Comfort',
    'Physiological Integrity: Pharmacological Therapies',
    'Physiological Integrity: Reduction of Risk Potential',
    'Physiological Integrity: Physiological Adaptation'
  )),
  secondary_category text,
  question_type text not null default 'single_select' check (question_type in ('single_select', 'multiple_select')),
  question_text text not null,
  correct_answer_rationale text not null,
  strategy_1_understand text not null,
  strategy_2_clear_stem text not null,
  strategy_3_identify_correct text not null,
  strategy_4_intro text,
  framework_id uuid references critical_thinking_frameworks(id),
  framework_application text not null default '',
  source_subject_tag text,
  source_question_number text,
  review_status text not null default 'draft' check (review_status in ('draft', 'review', 'approved', 'rejected')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  option_label text not null,
  display_order int not null,
  option_text text not null,
  is_correct boolean not null default false,
  option_rationale text
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
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

-- Row Level Security

alter table profiles enable row level security;
alter table beta_codes enable row level security;
alter table critical_thinking_frameworks enable row level security;
alter table questions enable row level security;
alter table question_options enable row level security;
alter table attempts enable row level security;
alter table raised_hands enable row level security;

create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "read active beta codes" on beta_codes for select using (true);

create policy "read frameworks" on critical_thinking_frameworks for select using (true);

create policy "read published questions" on questions for select using (is_published = true);

create policy "read options for published questions" on question_options for select using (
  exists (select 1 from questions where questions.id = question_options.question_id and questions.is_published = true)
);

create policy "read own attempts" on attempts for select using (auth.uid() = user_id);
create policy "insert own attempts" on attempts for insert with check (auth.uid() = user_id);

create policy "read own raised hands" on raised_hands for select using (auth.uid() = user_id);
create policy "insert own raised hands" on raised_hands for insert with check (auth.uid() = user_id);

-- Service role (used only inside serverless functions and the import script) bypasses RLS automatically,
-- so it can read/write draft and unpublished questions.
