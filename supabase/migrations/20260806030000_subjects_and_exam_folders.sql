-- Migration: subject metadata plus saved custom "exam" folders, for the review-builder
-- feature (Full / Pediatrics / Pharmacology / OB-GYN quick reviews, and student-built
-- custom subject sets they can name and reopen later).
--
-- Additive only: new tables, no changes to existing ones. Safe to run any time.

-- Lookup table, not a check constraint, so adding a specialty track later (Med-Surg,
-- Mental Health, Fundamentals, ...) never requires altering subjects again.
create table specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  display_order int not null default 0
);

insert into specialties (name, slug, display_order) values
  ('Pediatrics', 'pediatrics', 1),
  ('Pharmacology', 'pharmacology', 2),
  ('OB/GYN', 'ob-gyn', 3);

-- One row per distinct questions.subject value. The importer upserts into this table as
-- it imports each batch, so every subject that exists in questions is selectable here too.
-- specialty_id starts null for a brand new subject; tag it with an update statement when
-- you decide which specialty (if any) it belongs to, there's no admin UI for this yet.
create table subjects (
  name text primary key,
  specialty_id uuid references specialties(id),
  display_order int not null default 0
);

-- A student-built, named set of subjects ("My Exam 2 Review"). The Full/Pediatrics/
-- Pharmacology/OB-GYN quick-start buttons on the builder page don't create rows here,
-- they're computed on the fly from subjects/specialties; this table is only for sets the
-- student explicitly named and saved.
create table subject_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table subject_folder_items (
  folder_id uuid not null references subject_folders(id) on delete cascade,
  subject text not null references subjects(name) on delete cascade,
  primary key (folder_id, subject)
);

create index on subjects (specialty_id);
create index on subject_folders (user_id);
create index on subject_folder_items (subject);

alter table specialties enable row level security;
alter table subjects enable row level security;
alter table subject_folders enable row level security;
alter table subject_folder_items enable row level security;

create policy "read specialties" on specialties for select using (true);
create policy "read subjects" on subjects for select using (true);

create policy "read own folders" on subject_folders for select using ((select auth.uid()) = user_id);
create policy "insert own folders" on subject_folders for insert with check ((select auth.uid()) = user_id);
create policy "delete own folders" on subject_folders for delete using ((select auth.uid()) = user_id);

create policy "read own folder items" on subject_folder_items for select using (
  exists (select 1 from subject_folders where subject_folders.id = subject_folder_items.folder_id and subject_folders.user_id = (select auth.uid()))
);
create policy "insert own folder items" on subject_folder_items for insert with check (
  exists (select 1 from subject_folders where subject_folders.id = subject_folder_items.folder_id and subject_folders.user_id = (select auth.uid()))
);
create policy "delete own folder items" on subject_folder_items for delete using (
  exists (select 1 from subject_folders where subject_folders.id = subject_folder_items.folder_id and subject_folders.user_id = (select auth.uid()))
);
