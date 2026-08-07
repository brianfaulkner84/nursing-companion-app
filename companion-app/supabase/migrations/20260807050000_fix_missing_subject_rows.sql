-- Root-cause fix for the "Other" bucket ballooning back up and whole modules (Nursing Across
-- the Lifespan, The Nervous System, Care of the Pediatric Patient) disappearing from the
-- dashboard entirely.
--
-- The bug: migrations 030000 and 040000 renamed a batch of questions' subject text to a new
-- anchor name (e.g. `update questions set subject = 'Common Disorders of the Neurologic
-- System' where subject in (...)`) but never guaranteed a `subjects` row existed for that new
-- name with the right module_id. When the row doesn't exist, the dashboard can't find a module
-- for that subject string and dumps it into "Other" -- and if EVERY subject in a module got
-- renamed into homes like this, the whole module has zero categorized questions and the
-- dashboard hides it completely. A few plain module_id updates from 030000 also don't appear
-- to have taken effect (unclear if that script errored partway or wasn't run), so this migration
-- redoes those too. Everything here is idempotent and safe to run even if some of it already
-- happened.

-- ===== Step 1: guarantee every anchor subject has a row with the correct module_id =====

insert into subjects (name, module_id) values
  ('Common Disorders of the Neurologic System', (select id from modules where name = 'The Nervous System')),
  ('Neurological Assessment', (select id from modules where name = 'The Nervous System')),
  ('Neurogenic Shock', (select id from modules where name = 'The Nervous System')),
  ('Stroke', (select id from modules where name = 'The Nervous System')),
  ('CNS Medications', (select id from modules where name = 'The Nervous System')),

  ('Pain Management During Labor and Birth', (select id from modules where name = 'Nursing Care During Labor and Birth')),
  ('Complications During Labor and Birth', (select id from modules where name = 'Nursing Care During Labor and Birth')),
  ('Care of the Mother and Infant During Labor and Birth', (select id from modules where name = 'Nursing Care During Labor and Birth')),
  ('Labor and Birth Process', (select id from modules where name = 'Nursing Care During Labor and Birth')),
  ('Labor Interventions', (select id from modules where name = 'Nursing Care During Labor and Birth')),

  ('The Term Newborn', (select id from modules where name = 'Nursing Care During the Postpartum Period')),
  ('Postpartum Care', (select id from modules where name = 'Nursing Care During the Postpartum Period')),

  ('Maternity Nursing', (select id from modules where name = 'Reproductive Health Nursing')),

  ('Health Promotion and Care of the Older Adult', (select id from modules where name = 'Nursing Across the Lifespan')),
  ('Fundamentals of Community Health Nursing', (select id from modules where name = 'Nursing Across the Lifespan')),
  ('Adult Health Nursing', (select id from modules where name = 'Nursing Across the Lifespan')),

  ('Pediatric Nursing', (select id from modules where name = 'Care of the Pediatric Patient I')),
  ('Maternal-Pediatric Nursing', (select id from modules where name = 'Care of the Pediatric Patient I')),

  ('Body Mechanics and Patient Mobility', (select id from modules where name = 'Fundamentals of Clinical Practice')),
  ('Managing the Patient with Pain', (select id from modules where name = 'Fundamentals of Clinical Practice')),
  ('Medication Administration', (select id from modules where name = 'Fundamentals of Clinical Practice')),

  ('Professional roles', (select id from modules where name = 'Fundamentals of Nursing')),
  ('The Nursing Process and Developing Critical Judgement', (select id from modules where name = 'Fundamentals of Nursing')),
  ('Asepsis and Infection Control', (select id from modules where name = 'Fundamentals of Nursing')),

  ('Care of the Patient with an Addictive Personality', (select id from modules where name = 'Mental Health Nursing')),
  ('Concepts of Mental Health', (select id from modules where name = 'Mental Health Nursing')),

  ('Disorders of the Mouth, Esophagus and Stomach', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Pressure Injuries and Other Skin Disorders', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Drugs for the Integumentary System', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Drugs for the Gastrointestinal System', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),

  ('Disorders of the Urinary System', (select id from modules where name = 'The Urinary System')),
  ('Drugs for the Urinary System', (select id from modules where name = 'The Urinary System')),

  ('Care of Patient Experiencing Urgent Alterations in Health', (select id from modules where name = 'Introduction to Nursing Interventions')),
  ('Physical Assessment', (select id from modules where name = 'Introduction to Nursing Interventions')),

  ('Acute and Chronic Respiratory Disorders', (select id from modules where name = 'The Respiratory System')),

  ('Coronary Artery Disease', (select id from modules where name = 'Cardiovascular System II')),
  ('Drugs that Affect the Cardiovascular System', (select id from modules where name = 'Cardiovascular System II')),

  ('Drugs that Affect the Immune System', (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')),
  ('Disorders Associated with Platelets, Clotting Factors, and Plasma', (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')),

  ('Drugs that Affect the Musculoskeletal System', (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System'))
on conflict (name) do update set module_id = excluded.module_id;

-- ===== Step 2: redo the renames, now that every destination row is guaranteed to exist =====

update questions set subject = 'Common Disorders of the Neurologic System'
where subject in ('Seizure Management', 'Intracranial Pressure', 'Spinal Cord Injury');

update questions set subject = 'Maternity Nursing' where subject = 'Maternal Health';

update questions set subject = 'Pain Management During Labor and Birth'
where subject in (
  'Pharmacological Pain Management', 'Nonpharmacological Pain Management',
  'Labor Pain Factors', 'Labor Pain', 'Pain Management Techniques'
);
update questions set subject = 'Complications During Labor and Birth'
where subject in ('Fetal Monitoring', 'Labor Complications');
update questions set subject = 'Care of the Mother and Infant During Labor and Birth'
where subject in ('Childbirth Preparation', 'Childbirth Education');

update questions set subject = 'The Term Newborn'
where subject = 'Newborn Care';

update questions set subject = 'Health Promotion and Care of the Older Adult'
where subject in (
  'Institutional care', 'Palliative care', 'Elderly population', 'PACE program',
  'Chronic Conditions', 'Hospice care', 'Hospice Care', 'Long-term care', 'Long-term Care'
);
update questions set subject = 'Fundamentals of Community Health Nursing'
where subject in ('Immunizations', 'Infectious Disease', 'Communicable Diseases', 'Bioterrorism', 'Nursing Care');

update questions set subject = 'Body Mechanics and Patient Mobility'
where subject = 'Moving the Patient';
update questions set subject = 'Managing the Patient with Pain'
where subject in ('Chronic Pain', 'Pain Perception', 'Pain Classification', 'Hot Compress', 'Opioid Medications', 'Nonopioid Pain Medications');
update questions set subject = 'Medication Administration'
where subject = 'Medication Safety';

update questions set subject = 'Professional roles'
where subject = 'Interdisciplinary team';
update questions set subject = 'The Nursing Process and Developing Critical Judgement'
where subject = 'Nursing Process';
update questions set subject = 'Asepsis and Infection Control'
where subject = 'Inflammation';

update questions set subject = 'Care of the Patient with an Addictive Personality'
where subject = 'Drug Misuse';
update questions set subject = 'Concepts of Mental Health'
where subject in ('Defense Mechanisms', 'Illness Behavior', 'Mental Health Continuum');

update questions set subject = 'Disorders of the Mouth, Esophagus and Stomach'
where subject in ('Disorders of the Stomach', 'Disorders of the Mouth', 'Disorders of the Intestines');
update questions set subject = 'Pressure Injuries and Other Skin Disorders'
where subject = 'Skin Disorders';

update questions set subject = 'Disorders of the Urinary System'
where subject = 'Urinary Catheters';

-- Patient Safety and Physical Assessment: Patient Safety isn't a real book chapter, fold it
-- into the closest real TOC class instead of keeping the invented name.
update questions set subject = 'Care of Patient Experiencing Urgent Alterations in Health'
where subject in ('Patient Safety', 'Fall Prevention', 'Safety Reminder Devices');
update questions set subject = 'Physical Assessment'
where subject = 'Patient Assessment';

-- Respiratory Care isn't a real book chapter either -- fold into the real disorders chapter.
update questions set subject = 'Acute and Chronic Respiratory Disorders'
where subject in (
  'Respiratory Care', 'Oxygen Safety', 'Asthma Triggers', 'COPD Exacerbation',
  'Oxygen Delivery Devices', 'Tracheostomy Care', 'Asthma Pathophysiology'
);

-- Acute Coronary Syndrome isn't the book's chapter title -- the real one is Coronary Artery Disease.
update questions set subject = 'Coronary Artery Disease'
where subject in ('Acute Coronary Syndrome', 'Myocardial Infarction');

update questions set subject = 'Pharmacology'
where subject in ('Anti-inflammatory Drugs', 'Osteoporosis Treatment') and subject <> 'Pharmacology';

-- Pharmacology-by-system renames from 040000, redone with the row now guaranteed to exist.
update questions set subject = 'Drugs for the Urinary System' where subject = 'Renal and Urinary Drugs';
update questions set subject = 'Drugs that Affect the Immune System' where subject = 'Drugs Affecting the Immune System';
update questions set subject = 'Disorders Associated with Platelets, Clotting Factors, and Plasma' where subject = 'Anticoagulant and Hematologic Drugs';
update questions set subject = 'Drugs that Affect the Cardiovascular System' where subject = 'Cardiovascular Drugs';
update questions set subject = 'Drugs that Affect the Musculoskeletal System' where subject = 'Osteoporosis Treatment';

-- ===== Step 3: cleanup orphaned subject rows =====

delete from subjects
where name not in (select distinct subject from questions)
  and name not in (select distinct subject from subject_folder_items);

-- ===== Step 4: verify nothing is left uncategorized =====

select s.name, count(q.id) as question_count
from subjects s
join questions q on q.subject = s.name
where s.module_id is null
group by s.name
order by question_count desc;
