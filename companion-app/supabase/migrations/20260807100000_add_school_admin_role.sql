-- Scaffolds a fourth role, 'school_admin', between instructor and admin: an instructor with
-- elevated permissions scoped to their own school only -- remove people from the school,
-- downgrade someone's role, manage that school's codes -- as opposed to 'admin', which is
-- global across every school. This migration only makes the value valid in the database.
-- No route, page, or UI grants those capabilities yet, on purpose: Brian asked for this
-- scaffolded ahead of need, not built yet, same reasoning as the schools table itself --
-- cheap to add a valid enum value now, much riskier to retrofit once real school_admin
-- accounts and codes exist. When those capabilities do get built, they belong behind a new
-- helper alongside canReviewStudents/isAdmin in lib/roles.ts, scoped by school_id the same
-- way an instructor's queues already are.

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('student', 'instructor', 'school_admin', 'admin'));

-- beta_codes still can't grant 'admin' -- global admin stays a manual, trusted action (SQL or
-- ADMIN_EMAIL), never something distributable via a code. school_admin, like instructor and
-- student, will be issuable by code once the redemption/assignment flow for it exists.
alter table beta_codes drop constraint beta_codes_role_check;
alter table beta_codes add constraint beta_codes_role_check
  check (role in ('student', 'instructor', 'school_admin'));

-- Fort Gordon's first school_admin code. Redeeming this today grants everything an instructor
-- already gets (canReviewStudents treats school_admin as instructor-or-above, so /admin/inbox
-- and /admin/feedback work immediately) but NOT the elevated capabilities described for this
-- role -- removing someone from the school, downgrading a role, managing that school's codes --
-- since none of those routes exist yet. Hand this code out with that expectation set: it's a
-- trusted instructor account today, the extra power comes later.
insert into beta_codes (code, grant_type, active, role, school_id) values
  ('68C.ADM', 'lifetime-free', true, 'school_admin',
   (select id from schools where name = 'Fort Gordon 68C Practical Nurse Course'));
