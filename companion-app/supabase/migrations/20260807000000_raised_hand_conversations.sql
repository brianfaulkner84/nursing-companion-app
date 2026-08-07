-- Turns raise-a-hand from a single question/reply pair into an ongoing thread: the student
-- can keep replying, the instructor keeps replying, back and forth, all in-app. user_id here
-- is always the STUDENT's id (denormalized from raised_hands, even on instructor messages),
-- so one simple RLS policy covers "read every message in my own threads" regardless of who
-- sent it. All writes (student send/delete, instructor send) go through service-role API
-- routes that check ownership/role in code, same pattern as beta_codes and subscriptions, so
-- there are no insert/update/delete policies for the authenticated role here.

create table raised_hand_messages (
  id uuid primary key default gen_random_uuid(),
  raised_hand_id uuid not null references raised_hands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('student', 'instructor')),
  body text not null,
  created_at timestamptz not null default now()
);

create index on raised_hand_messages (raised_hand_id);
create index on raised_hand_messages (user_id);

alter table raised_hand_messages enable row level security;

create policy "read own thread messages" on raised_hand_messages for select using ((select auth.uid()) = user_id);

-- Lets the instructor "clear" answered threads out of /admin/inbox without touching the
-- student's own Inbox, which always shows everything regardless of this flag.
alter table raised_hands add column if not exists archived_by_instructor boolean not null default false;

-- Backfill: every existing raised_hands row predates this table, so its original note and
-- (if any) sent reply become that thread's first two messages. Guarded with not exists so
-- this is safe to run more than once.
insert into raised_hand_messages (raised_hand_id, user_id, sender, body, created_at)
select rh.id, rh.user_id, 'student', rh.student_note, rh.created_at
from raised_hands rh
where rh.student_note is not null and rh.student_note <> ''
  and not exists (
    select 1 from raised_hand_messages m where m.raised_hand_id = rh.id and m.sender = 'student'
  );

insert into raised_hand_messages (raised_hand_id, user_id, sender, body, created_at)
select rh.id, rh.user_id, 'instructor', rh.sent_reply, coalesce(rh.answered_at, rh.created_at)
from raised_hands rh
where rh.sent_reply is not null and rh.sent_reply <> ''
  and not exists (
    select 1 from raised_hand_messages m where m.raised_hand_id = rh.id and m.sender = 'instructor'
  );
