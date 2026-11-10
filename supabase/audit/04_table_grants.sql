-- READ-ONLY: table and view grants to public API roles.
-- RLS and SQL GRANT both matter; neither replaces the other.
SELECT
  g.table_schema,
  g.table_name,
  g.grantee,
  string_agg(DISTINCT g.privilege_type, ', ' ORDER BY g.privilege_type) AS granted_privileges
FROM information_schema.role_table_grants g
WHERE g.table_schema IN ('public', 'storage')
  AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')
GROUP BY g.table_schema,g.table_name,g.grantee
ORDER BY g.table_schema,g.table_name,g.grantee;
