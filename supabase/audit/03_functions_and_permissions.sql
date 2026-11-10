-- READ-ONLY: discover RPC functions and their EXECUTE permissions.
-- SECURITY DEFINER + anon_can_execute is a high-priority review item.
-- Do not publish function source that might contain secrets.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  CASE p.provolatile WHEN 'i' THEN 'immutable'
    WHEN 's' THEN 'stable' ELSE 'volatile' END AS volatility,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_can_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, arguments;
