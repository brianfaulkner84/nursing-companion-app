-- Delta migration: framework_application nullable, publish-safety already enforced
-- at the questions_publish_requires_approval constraint (no schema change needed there,
-- fixed in the importer instead), pinned search_path on set_updated_at(), and RLS
-- policies rewritten to wrap auth.uid() in a subquery per Supabase linter guidance.

alter table questions alter column framework_application drop not null;
alter table questions alter column framework_application drop default;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = '';

drop policy if exists "read own profile" on profiles;
drop policy if exists "update own profile" on profiles;
drop policy if exists "insert own profile" on profiles;
create policy "read own profile" on profiles for select using ((select auth.uid()) = id);
create policy "update own profile" on profiles for update using ((select auth.uid()) = id);
create policy "insert own profile" on profiles for insert with check ((select auth.uid()) = id);

drop policy if exists "read own attempts" on attempts;
drop policy if exists "insert own attempts" on attempts;
create policy "read own attempts" on attempts for select using ((select auth.uid()) = user_id);
create policy "insert own attempts" on attempts for insert with check ((select auth.uid()) = user_id);

drop policy if exists "read own raised hands" on raised_hands;
drop policy if exists "insert own raised hands" on raised_hands;
create policy "read own raised hands" on raised_hands for select using ((select auth.uid()) = user_id);
create policy "insert own raised hands" on raised_hands for insert with check ((select auth.uid()) = user_id);
