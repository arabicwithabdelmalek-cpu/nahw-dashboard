-- READ-ONLY: effective table permissions, including privileges inherited from PUBLIC.
-- RLS may further restrict rows; a TRUE below is not proof that rows are readable.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  c.relrowsecurity AS rls_enabled,
  pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
  pg_catalog.has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
  pg_catalog.has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
  pg_catalog.has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'DELETE') AS authenticated_delete
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p','v')
  AND (
    n.nspname = 'public'
    OR (n.nspname = 'storage' AND c.relname IN ('buckets','objects'))
  )
ORDER BY n.nspname,c.relname;
