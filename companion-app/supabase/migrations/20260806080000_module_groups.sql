-- Groups the 21 modules down to a shorter list of top-level dashboard buttons. Most
-- modules stand alone (Mental Health Nursing, The Urinary System, ...); a handful are
-- numbered parts of the same topic and collapse into one button that then splits back out
-- (Pediatrics -> I/II/III/IV). group_id is nullable: an unassigned module still displays as
-- its own standalone button, it just isn't part of a bigger group.

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

alter table modules add column group_id uuid references module_groups(id);

update modules set group_id = (select id from module_groups where name = 'Fundamentals of Nursing')
where name in ('Fundamentals of Nursing', 'Introduction to Nursing Interventions', 'Fundamentals of Clinical Practice');

update modules set group_id = (select id from module_groups where name = 'Cardiovascular')
where name in ('Cardiovascular System I', 'Cardiovascular System II');

update modules set group_id = (select id from module_groups where name = 'Maternity and Newborn Care')
where name in ('Reproductive Health Nursing', 'Nursing Care During Labor and Birth', 'Nursing Care During the Postpartum Period');

update modules set group_id = (select id from module_groups where name = 'Pediatrics')
where name in ('Care of the Pediatric Patient I', 'Care of the Pediatric Patient II', 'Care of the Pediatric Patient III', 'Care of the Pediatric Patient IV');

create index on modules (group_id);

alter table module_groups enable row level security;
create policy "read module groups" on module_groups for select using (true);
