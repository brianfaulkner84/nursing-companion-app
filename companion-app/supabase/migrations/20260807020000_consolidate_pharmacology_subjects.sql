-- Consolidates the Pharmacology module's subject tiles by drug class. Several subjects were
-- effectively fragments of the same class (five separate opioid tags, three
-- anticoagulant/hematologic tags, etc). This renames questions.subject to one canonical name
-- per class and registers that name in subjects with module_id already set to Pharmacology,
-- so the merged tile shows up correctly instead of falling into "Other". Old subject rows are
-- left in place (harmless, just unused) rather than deleted, since subject_folder_items has a
-- foreign key to subjects.name and deleting could silently break a student's saved review
-- folder if they'd saved one of the old names. A cleanup query at the bottom removes only the
-- ones that are safe to remove.

-- Opioid Medications: five fragments of the same drug class into one tile.
insert into subjects (name, module_id)
values ('Opioid Medications', (select id from modules where name = 'Pharmacology'))
on conflict (name) do update set module_id = excluded.module_id;

update questions set subject = 'Opioid Medications'
where subject in (
  'Opioid Agonist-Antagonists', 'Opioid Receptors', 'Opioid Analgesics',
  'Opioid Antagonists', 'Opioid Side Effects'
);

-- Nonopioid Pain Medications: separate from opioids, matches how your question bank already
-- distinguishes "Drugs for Pain Management" (general) from "Nonopioid Analgesics" (specific).
insert into subjects (name, module_id)
values ('Nonopioid Pain Medications', (select id from modules where name = 'Pharmacology'))
on conflict (name) do update set module_id = excluded.module_id;

update questions set subject = 'Nonopioid Pain Medications'
where subject in ('Nonopioid Analgesics', 'Drugs for Pain Management');

-- Antibiotics: "Drugs for Bacterial Infections" is the same class by another name.
insert into subjects (name, module_id)
values ('Antibiotics', (select id from modules where name = 'Pharmacology'))
on conflict (name) do update set module_id = excluded.module_id;

update questions set subject = 'Antibiotics'
where subject in ('Antibiotics', 'Drugs for Bacterial Infections');

-- Anticoagulant and Hematologic Drugs: anticoagulants are hematologic drugs, three tags for
-- one class.
insert into subjects (name, module_id)
values ('Anticoagulant and Hematologic Drugs', (select id from modules where name = 'Pharmacology'))
on conflict (name) do update set module_id = excluded.module_id;

update questions set subject = 'Anticoagulant and Hematologic Drugs'
where subject in ('Anticoagulant Therapy', 'Anticoagulants', 'Hematologic Drugs');

-- Cardiovascular Drugs: angina drugs are cardiovascular drugs.
insert into subjects (name, module_id)
values ('Cardiovascular Drugs', (select id from modules where name = 'Pharmacology'))
on conflict (name) do update set module_id = excluded.module_id;

update questions set subject = 'Cardiovascular Drugs'
where subject in ('Cardiovascular Drugs', 'Drugs for Angina');

-- Renal and Urinary Drugs: same class, two names.
insert into subjects (name, module_id)
values ('Renal and Urinary Drugs', (select id from modules where name = 'Pharmacology'))
on conflict (name) do update set module_id = excluded.module_id;

update questions set subject = 'Renal and Urinary Drugs'
where subject in ('Drugs for the Urinary System', 'Renal and Urinary System Drugs');

-- Left standalone, no duplicate to merge with: Anti-inflammatory Drugs, Drugs Affecting the
-- Immune System, Drugs for the Gastrointestinal System, Drugs for the Integumentary System,
-- Osteoporosis Treatment, Medication Safety, Pharmacology (the generic catch-all).

-- Cleanup: drop old subject names that no longer have any question or any saved review
-- folder pointing at them. Anything still referenced is left alone.
delete from subjects
where module_id = (select id from modules where name = 'Pharmacology')
  and name not in (select distinct subject from questions)
  and name not in (select distinct subject from subject_folder_items);

-- Verify: shows the consolidated Pharmacology tile list.
select s.name, count(q.id) as question_count
from subjects s
join questions q on q.subject = s.name
where s.module_id = (select id from modules where name = 'Pharmacology')
group by s.name
order by question_count desc;
