-- Course modules, replacing the earlier "body system" idea. Named and ordered directly
-- from the table of contents of the 8 LPN Launchpad study books (Exam 11 through Exam 31),
-- so the grouping matches what the student already sees in their course materials instead
-- of a new taxonomy Brian would have to invent and maintain. subjects.module_id is nullable
-- and tagged via update statements, same pattern as subjects.specialty_id.

create table modules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
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
  ('Care of the Pediatric Patient IV', 21);

alter table subjects add column module_id uuid references modules(id);
create index on subjects (module_id);

alter table modules enable row level security;
create policy "read modules" on modules for select using (true);
