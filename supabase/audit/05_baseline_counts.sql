-- READ-ONLY OPTIONAL BASELINE: aggregated counts, no private rows.
-- Only run AFTER 01_schema_inventory.sql confirms these objects exist.
-- Counts are for backup verification before/after migrations; they are NOT a backup.
SELECT 'public.profiles' AS object_name, count(*)::bigint AS row_count FROM public.profiles
UNION ALL SELECT 'public.classes', count(*) FROM public.classes
UNION ALL SELECT 'public.students', count(*) FROM public.students
UNION ALL SELECT 'public.lessons', count(*) FROM public.lessons
UNION ALL SELECT 'public.lesson_versions', count(*) FROM public.lesson_versions
UNION ALL SELECT 'public.lesson_files', count(*) FROM public.lesson_files
UNION ALL SELECT 'public.class_lessons', count(*) FROM public.class_lessons
UNION ALL SELECT 'public.submissions', count(*) FROM public.submissions
UNION ALL SELECT 'auth.users', count(*) FROM auth.users
UNION ALL SELECT 'storage.objects', count(*) FROM storage.objects;
