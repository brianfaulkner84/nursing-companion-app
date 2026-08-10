-- Backfills subjects that predate the import script's ensureSubject() upsert, adds a
-- Pharmacology module for drug-class topics that cut across body systems (none of the 21
-- book-derived modules fit these, since pharmacology appears as a sub-class within each
-- system's module, not as its own chapter), and tags all 99 by best-effort content match.
-- This is a judgment call, not a verified source match like the original TOC-based tagging.
-- Sanity check against your own knowledge of the course, especially the generic entries
-- (Chronic Conditions, Critical Care, Inflammation, Lab Skills).

insert into subjects (name)
select distinct q.subject
from questions q
left join subjects s on s.name = q.subject
where s.name is null
on conflict (name) do nothing;

insert into modules (name, display_order) values ('Pharmacology', 22)
on conflict (name) do nothing;

update subjects set module_id = (select id from modules where name = 'Pharmacology')
where name in (
  'Anti-inflammatory Drugs', 'Antibiotics', 'Anticoagulant Therapy', 'Anticoagulants',
  'Cardiovascular Drugs', 'Drugs Affecting the Immune System', 'Drugs for Angina',
  'Drugs for Bacterial Infections', 'Drugs for Pain Management',
  'Drugs for the Gastrointestinal System', 'Drugs for the Integumentary System',
  'Drugs for the Urinary System', 'Hematologic Drugs', 'Medication Safety',
  'Nonopioid Analgesics', 'Opioid Agonist-Antagonists', 'Opioid Analgesics',
  'Opioid Antagonists', 'Opioid Receptors', 'Opioid Side Effects', 'Osteoporosis Treatment',
  'Pharmacology', 'Renal and Urinary System Drugs'
);

update subjects set module_id = (select id from modules where name = 'Cardiovascular System I')
where name in ('Cardiovascular Alterations', 'Cardiovascular Care', 'Cardiovascular Nursing', 'Dysrhythmia Management');

update subjects set module_id = (select id from modules where name = 'Cardiovascular System II')
where name in ('Acute Coronary Syndrome', 'Myocardial Infarction');

update subjects set module_id = (select id from modules where name = 'The Respiratory System')
where name in (
  'Asthma Management', 'Asthma Pathophysiology', 'Asthma Triggers', 'COPD Exacerbation',
  'COPD Management', 'Oxygen Delivery Devices', 'Oxygen Safety', 'Oxygen Therapy',
  'Respiratory Assessment', 'Respiratory Care', 'Respiratory Disorders', 'Respiratory Nursing',
  'Tracheostomy Care'
);

update subjects set module_id = (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')
where name in (
  'Blood and Lymphatic Systems', 'Blood Products', 'Erythrocyte Disorders', 'HIV Care',
  'Immune System', 'Leukocyte Disorders', 'Lymphatic Disorders', 'Platelet Disorders'
);

update subjects set module_id = (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')
where name in (
  'Burns', 'Disorders of the Esophagus', 'Disorders of the Intestines', 'Disorders of the Mouth',
  'Disorders of the Stomach', 'Hepatobiliary System', 'Integumentary System', 'Pressure Ulcers',
  'Skin Disorders'
);

update subjects set module_id = (select id from modules where name = 'The Urinary System')
where name in ('Disorders of the Kidney', 'Disorders of the Urinary System', 'Introduction to the Urinary System', 'Urinary Catheters');

update subjects set module_id = (select id from modules where name = 'Mental Health Nursing')
where name in (
  'Anxiety', 'Crisis', 'Defense Mechanisms', 'Drug Misuse', 'Illness Behavior',
  'Mental Health Continuum', 'Mental Health Historical Overview', 'Personality',
  'Psychiatric Disorders', 'Substance Use and Recovery'
);

update subjects set module_id = (select id from modules where name = 'Nursing Across the Lifespan')
where name in (
  'Chronic Conditions', 'Elderly population', 'Hospice care', 'Hospice Care',
  'Institutional care', 'Long-term care', 'Long-term Care', 'PACE program', 'Palliative care'
);

update subjects set module_id = (select id from modules where name = 'Fundamentals of Clinical Practice')
where name in ('Chronic Pain', 'Lab Skills', 'Medication Administration', 'Pain Classification', 'Pain Management', 'Pain Perception');

update subjects set module_id = (select id from modules where name = 'Introduction to Nursing Interventions')
where name in (
  'Critical Care', 'Fluid and Electrolyte Balance', 'Patient Assessment', 'Patient Safety',
  'Rapid Response and Code Management'
);

update subjects set module_id = (select id from modules where name = 'Fundamentals of Nursing')
where name in ('Ethical Issues', 'Infection Control', 'Inflammation', 'Interdisciplinary team', 'Nursing Process', 'Professional roles');
