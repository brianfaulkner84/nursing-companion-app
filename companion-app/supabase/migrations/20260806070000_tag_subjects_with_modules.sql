-- Run this AFTER 20260806060000_modules.sql and AFTER you've confirmed the exact spelling
-- of your live subjects.name values (Supabase Table Editor > subjects, or
-- select name from subjects order by name;). Each class name below is copied verbatim from
-- the table of contents of the matching study book, so it should already be close to (or
-- exactly) your subject names. Any name that doesn't match a row in subjects is silently a
-- no-op, it won't error, so re-run this safely after fixing spelling. Subjects that never
-- get tagged fall into "Other" on the dashboard rather than disappearing.

update subjects set module_id = (select id from modules where name = 'Fundamentals of Nursing')
where name in ('Legal and Ethical Aspects of Nursing', 'The Nursing Process and Developing Critical Judgement', 'Asepsis and Infection Control');

update subjects set module_id = (select id from modules where name = 'Introduction to Nursing Interventions')
where name in ('Fluid and Electrolytes', 'Application of Nutritional Concepts and Related Therapies', 'Physical Assessment', 'Care of Patient Experiencing Urgent Alterations in Health', 'Surgical Wound Care');

update subjects set module_id = (select id from modules where name = 'Fundamentals of Clinical Practice')
where name in ('Medication Administration', 'Complementary and Alternative Medicine', 'Managing the Patient with Pain', 'Elimination and Gastric Intubation');

update subjects set module_id = (select id from modules where name = 'Nursing Across the Lifespan')
where name in ('Lifespan Development', 'Health Promotion and Care of the Older Adult', 'Loss, Grief, Death, and Dying', 'Fundamentals of Community Health Nursing');

update subjects set module_id = (select id from modules where name = 'Mental Health Nursing')
where name in ('Concepts of Mental Health', 'Drugs for Mental Health', 'Care of the Patient with a Psychiatric Disorder', 'Care of the Patient with an Addictive Personality');

update subjects set module_id = (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System')
where name in ('Perioperative and Preoperative Nursing', 'Intraoperative & Postoperative Nursing', 'Introduction to the Musculoskeletal System', 'Drugs that Affect the Musculoskeletal System', 'Inflammatory Disorders and Surgical Interventions of Total Knee and Hip Replacement', 'Fractures, Complications of Fractures, and Interventions', 'Traumatic Injuries, Surgical Intervention, and the Nursing Process');

update subjects set module_id = (select id from modules where name = 'Integumentary and Gastrointestinal Nursing')
where name in ('Introduction to the Integumentary System', 'Drugs for the Integumentary System', 'Pressure Injuries and Other Skin Disorders', 'Burns', 'Introduction to the Gastrointestinal and Hepatobiliary Systems', 'Drugs for the Gastrointestinal System', 'Disorders of the Mouth, Esophagus and Stomach', 'Disorders of the Intestines', 'Care of a Patient with a Hepatobiliary Tract Disorder');

update subjects set module_id = (select id from modules where name = 'The Urinary System')
where name in ('Introduction to the Urinary System', 'Drugs for the Urinary System', 'Disorders of the Urinary System', 'Disorders of the Kidney');

update subjects set module_id = (select id from modules where name = 'Blood, Lymphatic, and Immune Systems')
where name in ('Introduction to the Blood and Lymphatic Systems', 'Disorders Associated with Erythrocytes and Leukocytes', 'Disorders Associated with Platelets, Clotting Factors, and Plasma', 'Disorders of the Lymphatic System', 'The Immune System', 'Care of the Patient with HIV', 'Drugs that Affect the Immune System');

update subjects set module_id = (select id from modules where name = 'The Respiratory System')
where name in ('Introduction to the Respiratory System', 'Drugs for the Respiratory System', 'Upper Airway Disorders', 'Lower Airway Disorders', 'Acute and Chronic Respiratory Disorders');

update subjects set module_id = (select id from modules where name = 'Cardiovascular System I')
where name in ('Introduction to the Cardiovascular System', 'Drugs used for Cardiac Interventions', 'Cardiovascular Disorders', 'Dysrhythmia Interpretation and Management');

update subjects set module_id = (select id from modules where name = 'Cardiovascular System II')
where name in ('Drugs that Affect the Cardiovascular System', 'Coronary Artery Disease', 'Heart Failure and Pulmonary Edema', 'Inflammatory Heart Disorders', 'Valvular Heart Disease', 'Disorders of the Peripheral Vascular System');

update subjects set module_id = (select id from modules where name = 'Disorders of the Endocrine System')
where name in ('Introduction to the Endocrine System', 'Drugs that Affect the Endocrine System', 'Disorders of the Pituitary Gland', 'Disorders of the Thyroid, Parathyroid, and Adrenal Glands', 'Disorders of the Pancreas');

update subjects set module_id = (select id from modules where name = 'The Nervous System')
where name in ('Care of the Patient with an Eye Disorder', 'Care of the Patient with an Ear Disorder', 'Introduction to the Neurologic System', 'Drugs for Central Nervous System Problems', 'Common Disorders of the Neurologic System', 'Conductive Abnormalities and Degenerative Diseases', 'Cranial and Peripheral Nerve Disorders, Infection and Inflammation', 'Trauma and the Nursing Process for the Patient with Neurological Disorder');

update subjects set module_id = (select id from modules where name = 'Reproductive Health Nursing')
where name in ('Introduction to the Reproductive System', 'Drugs that Affect the Reproductive System', 'The Nurse''s Role in Women''s Health Care', 'Disorders of the Female Reproductive System', 'Disorders of the Male Reproductive System', 'Fetal Development', 'Prenatal Care and Adaption to Pregnancy', 'Nursing Care of Women with Complications During Pregnancy');

update subjects set module_id = (select id from modules where name = 'Nursing Care During Labor and Birth')
where name in ('Care of the Mother and Infant During Labor and Birth', 'Pain Management During Labor and Birth', 'Complications During Labor and Birth', 'The Family After Birth');

update subjects set module_id = (select id from modules where name = 'Nursing Care During the Postpartum Period')
where name in ('Complications After Birth', 'The Term Newborn', 'The Preterm and Post-term Newborn', 'Congenital Malformations and Perinatal Injury');

update subjects set module_id = (select id from modules where name = 'Care of the Pediatric Patient I')
where name in ('Growth, Development, and Nutrition', 'The Infant and Toddler', 'The Preschool and School-Aged Child', 'The Adolescent');

update subjects set module_id = (select id from modules where name = 'Care of the Pediatric Patient II')
where name in ('The Child Experience During Hospitalization', 'Healthcare Adaptions for the Child and Family', 'Childhood Communicable Disease, Bioterrorism, Natural Disasters, and the Maternal-Child Patient', 'Sensory and Neurological Conditions', 'Musculoskeletal Conditions');

update subjects set module_id = (select id from modules where name = 'Care of the Pediatric Patient III')
where name in ('The Child with Respiratory Disorders', 'The Child with a Gastrointestinal Condition', 'The Child with a Genitourinary Disorder', 'The Child with a Skin Condition', 'The Child with a Metabolic Condition');

update subjects set module_id = (select id from modules where name = 'Care of the Pediatric Patient IV')
where name in ('The Child with a Cardiovascular Disorder', 'The Child with a Condition of the Blood', 'The Child with an Emotional or Behavioral Condition', 'Complementary and Alternative Therapies in Maternity and Pediatric Nursing');
