-- Dissolves the invented "Pharmacology" catch-all where a drug class actually maps to a body
-- system in the source books, moving it into that system's real "Drugs for/that Affect the
-- [System]" TOC class. Two subjects (Drugs for the Integumentary System, Drugs for the
-- Gastrointestinal System) were already correctly tagged by the original 070000 book-TOC
-- migration, then got silently reassigned to Pharmacology by the later 100000 backfill
-- migration because its UPDATE ... WHERE name IN (...) matched on name alone and didn't
-- check whether the subject already had a correct module_id -- this restores those two.
--
-- Left in Pharmacology on purpose, no real single-system TOC home: the generic "Pharmacology"
-- catch-all itself, "Antibiotics" (infections span every system), and "Anti-inflammatory
-- Drugs" (used across MSK, integumentary, GI, and more, not one chapter's territory).

-- Restore the two subjects 100000 accidentally reassigned.
update subjects set module_id = (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')
where name in ('Drugs for the Integumentary System', 'Drugs for the Gastrointestinal System');

-- Renal and Urinary Drugs -> Drugs for the Urinary System (The Urinary System)
update questions set subject = 'Drugs for the Urinary System'
where subject = 'Renal and Urinary Drugs';

-- Drugs Affecting the Immune System -> Drugs that Affect the Immune System (Blood, Lymphatic, and Immune Systems)
update questions set subject = 'Drugs that Affect the Immune System'
where subject = 'Drugs Affecting the Immune System';

-- Anticoagulant and Hematologic Drugs -> Disorders Associated with Platelets, Clotting Factors, and Plasma (Blood, Lymphatic, and Immune Systems)
update questions set subject = 'Disorders Associated with Platelets, Clotting Factors, and Plasma'
where subject = 'Anticoagulant and Hematologic Drugs';

-- Cardiovascular Drugs -> Drugs that Affect the Cardiovascular System (Cardiovascular System II)
update questions set subject = 'Drugs that Affect the Cardiovascular System'
where subject = 'Cardiovascular Drugs';

-- Osteoporosis Treatment -> Drugs that Affect the Musculoskeletal System (Surgical Nursing and the Musculoskeletal System)
update questions set subject = 'Drugs that Affect the Musculoskeletal System'
where subject = 'Osteoporosis Treatment';

-- Opioid Medications, Nonopioid Pain Medications -> Managing the Patient with Pain (Fundamentals of Clinical Practice)
update questions set subject = 'Managing the Patient with Pain'
where subject in ('Opioid Medications', 'Nonopioid Pain Medications');

-- Medication Safety -> Medication Administration (Fundamentals of Clinical Practice)
update questions set subject = 'Medication Administration'
where subject = 'Medication Safety';

-- Cleanup: drop subject rows no longer referenced by any question or saved folder.
delete from subjects
where name not in (select distinct subject from questions)
  and name not in (select distinct subject from subject_folder_items);

-- Verify: what's left in Pharmacology now (should be just Pharmacology, Antibiotics,
-- Anti-inflammatory Drugs), and confirm nothing is uncategorized.
select coalesce(m.name, 'UNCATEGORIZED') as module_name, s.name as subject_name, count(q.id) as question_count
from subjects s
left join modules m on m.id = s.module_id
join questions q on q.subject = s.name
where s.module_id is null or m.name = 'Pharmacology'
group by m.name, s.name
order by module_name, question_count desc;
