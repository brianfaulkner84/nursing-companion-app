-- Root-cause fix for "Other" growing after ChatGPT renamed questions to match
-- subject_taxonomy.md: renaming question text to a canonical name does nothing for the
-- dashboard unless a `subjects` row exists for that exact name with the right module_id. The
-- last fix (050000) only pre-registered the ~40 names used as merge targets in earlier
-- migrations. ChatGPT's rename pass used the FULL taxonomy list (~100 names), most of which
-- never had a subjects row before, so they all fell into Other -- more of them than before,
-- since ChatGPT touched far more subject strings than the earlier migrations did.
--
-- This registers every single name in subject_taxonomy.md against its correct module, once,
-- so it doesn't matter which exact names ChatGPT used -- if it's in the taxonomy, it now has
-- a home. Idempotent, safe to re-run.

insert into subjects (name, module_id) values
  -- Fundamentals of Nursing
  ('Legal and Ethical Aspects of Nursing', (select id from modules where name = 'Fundamentals of Nursing')),
  ('The Nursing Process and Developing Critical Judgement', (select id from modules where name = 'Fundamentals of Nursing')),
  ('Asepsis and Infection Control', (select id from modules where name = 'Fundamentals of Nursing')),

  -- Introduction to Nursing Interventions
  ('Fluid and Electrolytes', (select id from modules where name = 'Introduction to Nursing Interventions')),
  ('Application of Nutritional Concepts and Related Therapies', (select id from modules where name = 'Introduction to Nursing Interventions')),
  ('Physical Assessment', (select id from modules where name = 'Introduction to Nursing Interventions')),
  ('Care of Patient Experiencing Urgent Alterations in Health', (select id from modules where name = 'Introduction to Nursing Interventions')),
  ('Surgical Wound Care', (select id from modules where name = 'Introduction to Nursing Interventions')),

  -- Fundamentals of Clinical Practice
  ('Medication Administration', (select id from modules where name = 'Fundamentals of Clinical Practice')),
  ('Complementary and Alternative Medicine', (select id from modules where name = 'Fundamentals of Clinical Practice')),
  ('Managing the Patient with Pain', (select id from modules where name = 'Fundamentals of Clinical Practice')),
  ('Elimination and Gastric Intubation', (select id from modules where name = 'Fundamentals of Clinical Practice')),

  -- Nursing Across the Lifespan
  ('Lifespan Development', (select id from modules where name = 'Nursing Across the Lifespan')),
  ('Health Promotion and Care of the Older Adult', (select id from modules where name = 'Nursing Across the Lifespan')),
  ('Loss, Grief, Death, and Dying', (select id from modules where name = 'Nursing Across the Lifespan')),
  ('Fundamentals of Community Health Nursing', (select id from modules where name = 'Nursing Across the Lifespan')),

  -- Mental Health Nursing
  ('Concepts of Mental Health', (select id from modules where name = 'Mental Health Nursing')),
  ('Drugs for Mental Health', (select id from modules where name = 'Mental Health Nursing')),
  ('Care of the Patient with a Psychiatric Disorder', (select id from modules where name = 'Mental Health Nursing')),
  ('Care of the Patient with an Addictive Personality', (select id from modules where name = 'Mental Health Nursing')),

  -- Surgical Nursing and the Musculoskeletal System
  ('Perioperative and Preoperative Nursing', (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System')),
  ('Intraoperative & Postoperative Nursing', (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System')),
  ('Introduction to the Musculoskeletal System', (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System')),
  ('Drugs that Affect the Musculoskeletal System', (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System')),
  ('Inflammatory Disorders and Surgical Interventions of Total Knee and Hip Replacement', (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System')),
  ('Fractures, Complications of Fractures, and Interventions', (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System')),
  ('Traumatic Injuries, Surgical Intervention, and the Nursing Process', (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System')),

  -- Integumentary and Gastrointestinal Nursing
  ('Introduction to the Integumentary System', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Drugs for the Integumentary System', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Pressure Injuries and Other Skin Disorders', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Burns', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Introduction to the Gastrointestinal and Hepatobiliary Systems', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Drugs for the Gastrointestinal System', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Disorders of the Mouth, Esophagus and Stomach', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Disorders of the Intestines', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),
  ('Care of a Patient with a Hepatobiliary Tract Disorder', (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')),

  -- The Urinary System
  ('Introduction to the Urinary System', (select id from modules where name = 'The Urinary System')),
  ('Drugs for the Urinary System', (select id from modules where name = 'The Urinary System')),
  ('Disorders of the Urinary System', (select id from modules where name = 'The Urinary System')),
  ('Disorders of the Kidney', (select id from modules where name = 'The Urinary System')),

  -- Blood, Lymphatic, and Immune Systems
  ('Introduction to the Blood and Lymphatic Systems', (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')),
  ('Disorders Associated with Erythrocytes and Leukocytes', (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')),
  ('Disorders Associated with Platelets, Clotting Factors, and Plasma', (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')),
  ('Disorders of the Lymphatic System', (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')),
  ('The Immune System', (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')),
  ('Care of the Patient with HIV', (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')),
  ('Drugs that Affect the Immune System', (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')),

  -- The Respiratory System
  ('Introduction to the Respiratory System', (select id from modules where name = 'The Respiratory System')),
  ('Drugs for the Respiratory System', (select id from modules where name = 'The Respiratory System')),
  ('Upper Airway Disorders', (select id from modules where name = 'The Respiratory System')),
  ('Lower Airway Disorders', (select id from modules where name = 'The Respiratory System')),
  ('Acute and Chronic Respiratory Disorders', (select id from modules where name = 'The Respiratory System')),

  -- Cardiovascular System I
  ('Introduction to the Cardiovascular System', (select id from modules where name = 'Cardiovascular System I')),
  ('Drugs used for Cardiac Interventions', (select id from modules where name = 'Cardiovascular System I')),
  ('Cardiovascular Disorders', (select id from modules where name = 'Cardiovascular System I')),
  ('Dysrhythmia Interpretation and Management', (select id from modules where name = 'Cardiovascular System I')),

  -- Cardiovascular System II
  ('Drugs that Affect the Cardiovascular System', (select id from modules where name = 'Cardiovascular System II')),
  ('Coronary Artery Disease', (select id from modules where name = 'Cardiovascular System II')),
  ('Heart Failure and Pulmonary Edema', (select id from modules where name = 'Cardiovascular System II')),
  ('Inflammatory Heart Disorders', (select id from modules where name = 'Cardiovascular System II')),
  ('Valvular Heart Disease', (select id from modules where name = 'Cardiovascular System II')),
  ('Disorders of the Peripheral Vascular System', (select id from modules where name = 'Cardiovascular System II')),

  -- Disorders of the Endocrine System
  ('Introduction to the Endocrine System', (select id from modules where name = 'Disorders of the Endocrine System')),
  ('Drugs that Affect the Endocrine System', (select id from modules where name = 'Disorders of the Endocrine System')),
  ('Disorders of the Pituitary Gland', (select id from modules where name = 'Disorders of the Endocrine System')),
  ('Disorders of the Thyroid, Parathyroid, and Adrenal Glands', (select id from modules where name = 'Disorders of the Endocrine System')),
  ('Disorders of the Pancreas', (select id from modules where name = 'Disorders of the Endocrine System')),

  -- The Nervous System
  ('Care of the Patient with an Eye Disorder', (select id from modules where name = 'The Nervous System')),
  ('Care of the Patient with an Ear Disorder', (select id from modules where name = 'The Nervous System')),
  ('Introduction to the Neurologic System', (select id from modules where name = 'The Nervous System')),
  ('Drugs for Central Nervous System Problems', (select id from modules where name = 'The Nervous System')),
  ('Common Disorders of the Neurologic System', (select id from modules where name = 'The Nervous System')),
  ('Conductive Abnormalities and Degenerative Diseases', (select id from modules where name = 'The Nervous System')),
  ('Cranial and Peripheral Nerve Disorders, Infection and Inflammation', (select id from modules where name = 'The Nervous System')),
  ('Trauma and the Nursing Process for the Patient with Neurological Disorder', (select id from modules where name = 'The Nervous System')),

  -- Reproductive Health Nursing
  ('Introduction to the Reproductive System', (select id from modules where name = 'Reproductive Health Nursing')),
  ('Drugs that Affect the Reproductive System', (select id from modules where name = 'Reproductive Health Nursing')),
  ('The Nurse''s Role in Women''s Health Care', (select id from modules where name = 'Reproductive Health Nursing')),
  ('Disorders of the Female Reproductive System', (select id from modules where name = 'Reproductive Health Nursing')),
  ('Disorders of the Male Reproductive System', (select id from modules where name = 'Reproductive Health Nursing')),
  ('Fetal Development', (select id from modules where name = 'Reproductive Health Nursing')),
  ('Prenatal Care and Adaption to Pregnancy', (select id from modules where name = 'Reproductive Health Nursing')),
  ('Nursing Care of Women with Complications During Pregnancy', (select id from modules where name = 'Reproductive Health Nursing')),

  -- Nursing Care During Labor and Birth
  ('Care of the Mother and Infant During Labor and Birth', (select id from modules where name = 'Nursing Care During Labor and Birth')),
  ('Pain Management During Labor and Birth', (select id from modules where name = 'Nursing Care During Labor and Birth')),
  ('Complications During Labor and Birth', (select id from modules where name = 'Nursing Care During Labor and Birth')),
  ('The Family After Birth', (select id from modules where name = 'Nursing Care During Labor and Birth')),

  -- Nursing Care During the Postpartum Period
  ('Complications After Birth', (select id from modules where name = 'Nursing Care During the Postpartum Period')),
  ('The Term Newborn', (select id from modules where name = 'Nursing Care During the Postpartum Period')),
  ('The Preterm and Post-term Newborn', (select id from modules where name = 'Nursing Care During the Postpartum Period')),
  ('Congenital Malformations and Perinatal Injury', (select id from modules where name = 'Nursing Care During the Postpartum Period')),

  -- Care of the Pediatric Patient I
  ('Growth, Development, and Nutrition', (select id from modules where name = 'Care of the Pediatric Patient I')),
  ('The Infant and Toddler', (select id from modules where name = 'Care of the Pediatric Patient I')),
  ('The Preschool and School-Aged Child', (select id from modules where name = 'Care of the Pediatric Patient I')),
  ('The Adolescent', (select id from modules where name = 'Care of the Pediatric Patient I')),

  -- Care of the Pediatric Patient II
  ('The Child Experience During Hospitalization', (select id from modules where name = 'Care of the Pediatric Patient II')),
  ('Healthcare Adaptions for the Child and Family', (select id from modules where name = 'Care of the Pediatric Patient II')),
  ('Childhood Communicable Disease, Bioterrorism, Natural Disasters, and the Maternal-Child Patient', (select id from modules where name = 'Care of the Pediatric Patient II')),
  ('Sensory and Neurological Conditions', (select id from modules where name = 'Care of the Pediatric Patient II')),
  ('Musculoskeletal Conditions', (select id from modules where name = 'Care of the Pediatric Patient II')),

  -- Care of the Pediatric Patient III
  ('The Child with Respiratory Disorders', (select id from modules where name = 'Care of the Pediatric Patient III')),
  ('The Child with a Gastrointestinal Condition', (select id from modules where name = 'Care of the Pediatric Patient III')),
  ('The Child with a Genitourinary Disorder', (select id from modules where name = 'Care of the Pediatric Patient III')),
  ('The Child with a Skin Condition', (select id from modules where name = 'Care of the Pediatric Patient III')),
  ('The Child with a Metabolic Condition', (select id from modules where name = 'Care of the Pediatric Patient III')),

  -- Care of the Pediatric Patient IV
  ('The Child with a Cardiovascular Disorder', (select id from modules where name = 'Care of the Pediatric Patient IV')),
  ('The Child with a Condition of the Blood', (select id from modules where name = 'Care of the Pediatric Patient IV')),
  ('The Child with an Emotional or Behavioral Condition', (select id from modules where name = 'Care of the Pediatric Patient IV')),
  ('Complementary and Alternative Therapies in Maternity and Pediatric Nursing', (select id from modules where name = 'Care of the Pediatric Patient IV')),

  -- Pharmacology (not a book chapter)
  ('Pharmacology', (select id from modules where name = 'Pharmacology')),
  ('Antibiotics', (select id from modules where name = 'Pharmacology')),
  ('Anti-inflammatory Drugs', (select id from modules where name = 'Pharmacology'))

on conflict (name) do update set module_id = excluded.module_id;

-- ===== Verify: anything still uncategorized after registering the full taxonomy =====
-- Anything that shows up here is a subject name in use that ISN'T an exact taxonomy name --
-- either ChatGPT typo'd/paraphrased it, or it's old content that still needs a rename.

select s.name, count(q.id) as question_count
from subjects s
join questions q on q.subject = s.name
where s.module_id is null
group by s.name
order by question_count desc;
