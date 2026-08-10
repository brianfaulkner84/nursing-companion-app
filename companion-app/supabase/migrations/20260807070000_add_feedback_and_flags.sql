-- In-app feedback for beta testers: general app feedback (usability, bugs, suggestions) and
-- per-question content-quality flags, kept as two separate tables since they're reviewed
-- differently -- general feedback is read and closed out, a question flag should point the
-- instructor straight at the question that needs a content fix. Neither collects an email
-- address; both tie only to auth.users(id), same privacy posture as raised_hands.

create table app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'general' check (category in ('general', 'bug', 'suggestion')),
  body text not null,
  status text not null default 'new' check (status in ('new', 'reviewed')),
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
  created_at timestamptz not null default now()
);

create index on app_feedback (user_id);
create index on app_feedback (status);
create index on question_flags (question_id);
create index on question_flags (status);

alter table app_feedback enable row level security;
alter table question_flags enable row level security;

create policy "read own feedback" on app_feedback for select using ((select auth.uid()) = user_id);
create policy "insert own feedback" on app_feedback for insert with check ((select auth.uid()) = user_id);

create policy "read own question flags" on question_flags for select using ((select auth.uid()) = user_id);
create policy "insert own question flags" on question_flags for insert with check ((select auth.uid()) = user_id);

-- No update/delete policy for the authenticated role on either table, same pattern as
-- raised_hands: status changes (marking reviewed/resolved) go through service-role admin
-- API routes that check ADMIN_EMAIL server-side, not client-writable RLS.
