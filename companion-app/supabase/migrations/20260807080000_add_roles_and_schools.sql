-- Introduces three real roles (student, instructor, admin) and a schools table, replacing
-- the single-ADMIN_EMAIL-env-var model that only ever supported one person. Built now, on
-- purpose, even though only one school exists today: retrofitting school_id onto tables full
-- of real student data later would be a much riskier migration than adding one nullable
-- column and a single seed row while nothing is live yet.
--
-- Deliberately NOT built yet: a multi-school admin UI, or school-level billing/expiration.
-- Codes are still hand-inserted via SQL, same as today, just carrying a role and school_id
-- now. Build that UI when a second real school shows up, not before.

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- The one school that exists today. Every existing profile and code backfills to this row.
insert into schools (name) values ('LPN Launchpad');

alter table schools enable row level security;
create policy "read schools" on schools for select using (true);

alter table profiles add column role text not null default 'student' check (role in ('student', 'instructor', 'admin'));
alter table profiles add column school_id uuid references schools(id);

update profiles set school_id = (select id from schools limit 1) where school_id is null;

-- Belt-and-suspenders: if a profile row already exists for the known admin account, promote
-- it now. If it doesn't exist yet (first sign-in hasn't happened), app code still falls back
-- to checking auth email against ADMIN_EMAIL until this row exists, so nobody gets locked out
-- either way.
update profiles set role = 'admin'
from auth.users
where profiles.id = auth.users.id
  and auth.users.email = 'brian.faulkner84@gmail.com';

-- SECURITY: the existing "update own profile" policy lets a signed-in user update any column
-- on their own row, with no column restriction. Adding role/school_id as more plain columns
-- would let a student grant themselves instructor/admin by patching their own profile row
-- directly, the same class of bug the beta-code redemption fix caught earlier (client-side
-- checks that should have been server-side). This trigger blocks role, school_id,
-- access_type, and beta_code_used from changing except when the write comes from the service
-- role (i.e. through a server-side API route using the service key, like redeem-code or a
-- future admin promote-user route). auth.role() reflects the JWT's role claim: 'service_role'
-- for service-key requests, 'authenticated' for a normal signed-in user.
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
  then
    raise exception 'role, school_id, access_type, and beta_code_used can only be changed by the service role';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_prevent_self_privilege_escalation on profiles;
create trigger profiles_prevent_self_privilege_escalation
before update on profiles
for each row execute function prevent_self_privilege_escalation();

-- Codes now carry which role and which school they grant. Existing codes default to
-- granting a student seat at the one school that exists today.
alter table beta_codes add column role text not null default 'student' check (role in ('student', 'instructor'));
alter table beta_codes add column school_id uuid references schools(id);
update beta_codes set school_id = (select id from schools limit 1) where school_id is null;

-- Records which specific instructor sent a reply. raised_hand_messages.user_id is always the
-- STUDENT's id even on instructor messages (deliberate, keeps RLS to one simple policy, see
-- the 20260807000000 migration) -- so once more than one instructor exists there was no way
-- to tell them apart. sender_id is the actual author's id: null for student messages (implied
-- by user_id), the replying instructor's id for instructor messages. Needed for the audit
-- visibility Brian asked for -- seeing which instructor handled which thread.
alter table raised_hand_messages add column sender_id uuid references auth.users(id);

-- Feedback and question flags escalate exactly one level: a student's submission is visible
-- to instructors and admin, an instructor's submission is visible to admin only (skips the
-- instructor queue entirely, since instructors don't review each other's escalations to
-- Brian). sender_role is captured from the submitter's profile at insert time.
alter table app_feedback add column sender_role text not null default 'student' check (sender_role in ('student', 'instructor'));
alter table question_flags add column sender_role text not null default 'student' check (sender_role in ('student', 'instructor'));

create index on profiles (school_id);
create index on raised_hand_messages (sender_id);
create index on app_feedback (sender_role);
create index on question_flags (sender_role);
