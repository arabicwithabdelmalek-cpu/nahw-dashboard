-- READ-ONLY: inspect RLS for public and storage tables.
-- A policy that says TO authenticated without row-specific USING may still be unsafe.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'name', p.policyname,
        'permissive', p.permissive,
        'roles', to_jsonb(p.roles),
        'command', p.cmd,
        'using', p.qual,
        'with_check', p.with_check
      ) ORDER BY p.policyname)
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = n.nspname AND p.tablename = c.relname
  ), '[]'::jsonb) AS policies
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p')
  AND (n.nspname = 'public'
       OR (n.nspname = 'storage' AND c.relname IN ('buckets','objects')))
ORDER BY n.nspname,c.relname;
