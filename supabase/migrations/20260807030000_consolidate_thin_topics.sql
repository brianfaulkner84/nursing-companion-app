-- Folds thin, fragmented subjects into an existing broader subject in the same module,
-- rather than leaving every disease process as its own tile (e.g. Asthma Pathophysiology,
-- Asthma Triggers, Oxygen Safety, Oxygen Delivery Devices, and COPD Exacerbation all become
-- "Respiratory Care" instead of five separate 1-4 question tiles). Also finishes the pending
-- base tagging for the Pediatric/OB/community-health cluster that was still sitting in
-- "Other". Idempotent, safe to re-run.
--
-- Pattern per group: make sure the anchor subject exists with the right module_id, retag
-- every question from the fragment names to the anchor name, then a cleanup step at the
-- bottom removes the now-orphaned old subject rows (skipping any still referenced by a
-- student's saved review folder).

-- ===== Plain tagging, no merge (subjects substantial enough to stay standalone) =====

update subjects set module_id = (select id from modules where name = 'The Nervous System')
where name in ('Neurological Assessment', 'Neurogenic Shock', 'Stroke', 'CNS Medications');

update subjects set module_id = (select id from modules where name = 'Nursing Care During Labor and Birth')
where name in ('Labor and Birth Process', 'Labor Interventions');

update subjects set module_id = (select id from modules where name = 'Nursing Care During the Postpartum Period')
where name = 'Postpartum Care';

update subjects set module_id = (select id from modules where name = 'Care of the Pediatric Patient I')
where name = 'Pediatric Nursing';

update subjects set module_id = (select id from modules where name = 'Nursing Across the Lifespan')
where name = 'Adult Health Nursing';

-- ===== Merge: Maternity/Maternal generic catch-alls =====
insert into subjects (name, module_id)
values ('Maternity Nursing', (select id from modules where name = 'Reproductive Health Nursing'))
on conflict (name) do update set module_id = excluded.module_id;
update questions set subject = 'Maternity Nursing' where subject in ('Maternity Nursing', 'Maternal Health');

-- ===== The Nervous System: fold specific conditions into the existing disorders chapter =====
update questions set subject = 'Common Disorders of the Neurologic System'
where subject in ('Seizure Management', 'Intracranial Pressure', 'Spinal Cord Injury');

-- ===== Nursing Care During Labor and Birth =====
update questions set subject = 'Pain Management During Labor and Birth'
where subject in (
  'Pharmacological Pain Management', 'Nonpharmacological Pain Management',
  'Labor Pain Factors', 'Labor Pain', 'Pain Management Techniques'
);
update questions set subject = 'Complications During Labor and Birth'
where subject in ('Fetal Monitoring', 'Labor Complications');
update questions set subject = 'Care of the Mother and Infant During Labor and Birth'
where subject in ('Childbirth Preparation', 'Childbirth Education');

-- ===== Nursing Care During the Postpartum Period =====
update questions set subject = 'The Term Newborn'
where subject = 'Newborn Care';

-- ===== Nursing Across the Lifespan: elderly/chronic/community-care cluster =====
update questions set subject = 'Health Promotion and Care of the Older Adult'
where subject in (
  'Institutional care', 'Palliative care', 'Elderly population', 'PACE program',
  'Chronic Conditions', 'Hospice care', 'Hospice Care', 'Long-term care', 'Long-term Care'
);
update questions set subject = 'Fundamentals of Community Health Nursing'
where subject in ('Immunizations', 'Infectious Disease', 'Communicable Diseases', 'Bioterrorism', 'Nursing Care');

-- ===== Fundamentals of Clinical Practice =====
update questions set subject = 'Body Mechanics and Patient Mobility'
where subject in ('Body Mechanics and Patient Mobility', 'Moving the Patient');
update questions set subject = 'Managing the Patient with Pain'
where subject in ('Chronic Pain', 'Pain Perception', 'Pain Classification', 'Hot Compress');

-- ===== Fundamentals of Nursing =====
update questions set subject = 'Professional roles'
where subject in ('Professional roles', 'Interdisciplinary team');
update questions set subject = 'The Nursing Process and Developing Critical Judgement'
where subject = 'Nursing Process';
update questions set subject = 'Asepsis and Infection Control'
where subject = 'Inflammation';

-- ===== Mental Health Nursing =====
update questions set subject = 'Care of the Patient with an Addictive Personality'
where subject = 'Drug Misuse';
update questions set subject = 'Concepts of Mental Health'
where subject in ('Defense Mechanisms', 'Illness Behavior', 'Mental Health Continuum');

-- ===== Integumentary and Gastrointestinal Nursing =====
update questions set subject = 'Disorders of the Mouth, Esophagus and Stomach'
where subject in ('Disorders of the Stomach', 'Disorders of the Mouth', 'Disorders of the Intestines');
update questions set subject = 'Pressure Injuries and Other Skin Disorders'
where subject = 'Skin Disorders';

-- ===== The Urinary System =====
update questions set subject = 'Disorders of the Urinary System'
where subject = 'Urinary Catheters';

-- ===== Introduction to Nursing Interventions =====
update questions set subject = 'Patient Safety'
where subject in ('Fall Prevention', 'Safety Reminder Devices');
update questions set subject = 'Physical Assessment'
where subject = 'Patient Assessment';

-- ===== The Respiratory System =====
update questions set subject = 'Respiratory Care'
where subject in (
  'Oxygen Safety', 'Asthma Triggers', 'COPD Exacerbation',
  'Oxygen Delivery Devices', 'Tracheostomy Care', 'Asthma Pathophysiology'
);

-- ===== Cardiovascular System II =====
update questions set subject = 'Acute Coronary Syndrome'
where subject in ('Myocardial Infarction', 'Acute Coronary Syndrome');

-- ===== Pharmacology: fold standalone one-off drug topics into the generic bucket =====
update questions set subject = 'Pharmacology'
where subject in ('Medication Safety', 'Anti-inflammatory Drugs', 'Osteoporosis Treatment');

-- ===== Cleanup: drop subject rows no longer referenced by any question or saved folder =====
delete from subjects
where name not in (select distinct subject from questions)
  and name not in (select distinct subject from subject_folder_items);

-- ===== Verify: anything still uncategorized, and the current thin-topic count =====
select s.name, count(q.id) as question_count
from subjects s
join questions q on q.subject = s.name
where s.module_id is null
group by s.name
order by question_count desc;
