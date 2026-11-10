-- READ-ONLY: run in the SQL Editor of project vkjkkezuyhhlcrxlvdbr only.
-- Metadata only: no student names, emails, answers, or passwords.
-- This query inspects public tables/views and selected platform-managed objects.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned table'
    WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view' ELSE c.relkind::text END AS object_type,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'column', a.attname,
        'type', pg_catalog.format_type(a.atttypid,a.atttypmod),
        'not_null', a.attnotnull
      ) ORDER BY a.attnum)
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  ), '[]'::jsonb) AS columns_metadata,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('name',co.conname,'kind',co.contype,'definition',pg_get_constraintdef(co.oid))
      ORDER BY co.conname)
    FROM pg_catalog.pg_constraint co
    WHERE co.conrelid = c.oid
  ), '[]'::jsonb) AS constraints_metadata
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p','v','m')
  AND (
    n.nspname = 'public'
    OR (n.nspname = 'storage' AND c.relname IN ('buckets', 'objects'))
    OR (n.nspname = 'auth' AND c.relname IN ('users', 'identities', 'sessions'))
  )
ORDER BY n.nspname,c.relname;
