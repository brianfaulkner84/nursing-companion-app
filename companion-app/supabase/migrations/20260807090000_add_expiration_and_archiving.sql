-- School-level package expiration and manual archiving, for schools/students whose access
-- needs to end (semester over, contract not renewed, an instructor leaves, a student removed,
-- someone redeemed the wrong code). Expiration is automatic and immediate: hasAccess() checks
-- access_expires_at on every access-gated page load, so a package quietly lapsing doesn't
-- need a daily job to actually cut anyone off. Archiving is a manual override for "this ends
-- now, regardless of any date" -- a school that stops paying mid-semester, or a single
-- student/instructor pulled individually without archiving their whole school.
--
-- Archiving locks a person out entirely but keeps their data untouched (attempts, raised
-- hands, everything) -- if a school renews, or a student's access is restored, everything
-- picks back up exactly where it left off. Nothing here deletes anything.

alter table schools add column access_expires_at timestamptz;
alter table schools add column archived_at timestamptz;

-- Independent of school-level archiving: pulling one student or instructor without archiving
-- their whole school (removed from the organization, redeemed the wrong code and needs
-- resetting, etc).
alter table profiles add column archived_at timestamptz;

create index on schools (access_expires_at);
create index on schools (archived_at);
create index on profiles (archived_at);

-- Extend the existing privilege-escalation guard (20260807080000) to also cover
-- archived_at -- without this, an archived student could simply un-archive themselves by
-- updating their own profile row, the same way they could have granted themselves paid access
-- before that trigger existed.
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
$$ language plpgsql security definer set search_path = public;
