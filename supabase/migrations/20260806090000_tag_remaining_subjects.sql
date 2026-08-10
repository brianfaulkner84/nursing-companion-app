-- Follow-up to 20260806070000_tag_subjects_with_modules.sql. These 17 subjects didn't match
-- any class name pulled from a book's table of contents because they're skill-level topics
-- from the "Active Learning Notes" checklists, not chapter titles. Grouped here by best fit
-- based on content, not a verified TOC match, so sanity check against your own knowledge of
-- the course.

update subjects set module_id = (select id from modules where name = 'Fundamentals of Nursing')
where name in ('Communication', 'Cultural and Ethnic Considerations', 'Documentation', 'Nursing Process and Critical Thinking');

update subjects set module_id = (select id from modules where name = 'Introduction to Nursing Interventions')
where name in ('Intravenous Therapy', 'Fall Prevention', 'Safety Reminder Devices');

update subjects set module_id = (select id from modules where name = 'Fundamentals of Clinical Practice')
where name in ('Bathing and Hygiene', 'Body Mechanics', 'Body Mechanics and Patient Mobility', 'Heat Applications', 'Hot Compress', 'Leg Exercises', 'Moving the Patient');

update subjects set module_id = (select id from modules where name = 'Surgical Nursing and the Musculoskeletal System')
where name in ('Incentive Spirometry', 'Respiratory Preparation', 'Skin Preparation');
