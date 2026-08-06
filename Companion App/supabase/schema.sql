-- Nursing Companion App: Supabase schema
-- Run this in the Supabase SQL editor once your project exists.

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

create table questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  primary_category text not null,
  secondary_category text,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  strategy_1_understand text not null,
  strategy_2_remove_distractors text not null,
  strategy_3_identify_correct text not null,
  strategy_4_eliminate_incorrect text not null,
  strategy_5_framework text not null default 'none',
  rationale text not null,
  source_subject_tag text,
  created_date date not null default current_date
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  correct boolean not null,
  created_at timestamptz not null default now()
);

create table raised_hands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_option text not null,
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
alter table questions enable row level security;
alter table attempts enable row level security;
alter table raised_hands enable row level security;

create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "read active beta codes" on beta_codes for select using (true);

create policy "read all questions" on questions for select using (true);

create policy "read own attempts" on attempts for select using (auth.uid() = user_id);
create policy "insert own attempts" on attempts for insert with check (auth.uid() = user_id);

create policy "read own raised hands" on raised_hands for select using (auth.uid() = user_id);
create policy "insert own raised hands" on raised_hands for insert with check (auth.uid() = user_id);

-- Service role (used only inside serverless functions) bypasses RLS automatically.
