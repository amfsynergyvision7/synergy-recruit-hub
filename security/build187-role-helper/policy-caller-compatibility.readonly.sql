-- BUILD187 READ-ONLY session-identity caller compatibility preflight.
-- No user_roles, business, audit, candidate, billing or private row reads.
-- All pg_policies expressions must use has_role(auth.uid(),<role>) exclusively.
-- This cannot prove that external application RPC callers are compatible.
WITH dependent AS (
 SELECT schemaname,tablename,policyname,cmd,
  coalesce(qual,'')||' '||coalesce(with_check,'') AS expr
 FROM pg_catalog.pg_policies
 WHERE (coalesce(qual,'')||' '||coalesce(with_check,'')) ~*
  '(^|[^[:alnum:]_])has_role[[:space:]]*\('
), classified AS (
 SELECT schemaname,tablename,policyname,cmd,
  -- Remove each *approved form*, then look for any remaining has_role( calls.
  regexp_replace(expr,
   'has_role[[:space:]]*\([[:space:]]*auth[.]uid[[:space:]]*\([[:space:]]*\)[[:space:]]*,',
   'SESSION_BOUND_CALL(', 'gi') AS remainder
 FROM dependent
), facts AS (
 SELECT
  (SELECT count(*) FROM dependent)::integer AS dependent_policy_count,
  (SELECT count(*) FROM classified WHERE remainder ~*
    '(^|[^[:alnum:]_])has_role[[:space:]]*\(')::integer
    AS non_session_bound_policy_count,
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',schemaname,'table',tablename,'policy',policyname,'command',cmd)
    ORDER BY schemaname,tablename,policyname),'[]'::jsonb)
   FROM classified WHERE remainder ~*
    '(^|[^[:alnum:]_])has_role[[:space:]]*\(') AS nonconforming_policy_identifiers,
  pg_catalog.to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL
   AS production_helper_signature_present
)
SELECT dependent_policy_count,non_session_bound_policy_count,
 nonconforming_policy_identifiers,production_helper_signature_present,
 CASE WHEN NOT production_helper_signature_present
    THEN 'HOLD_SHARED_HELPER_MISSING_NO_HOSTED_PARITY'
  WHEN dependent_policy_count=0
    THEN 'HOLD_NO_DEPENDENT_POLICY_EVIDENCE'
  WHEN non_session_bound_policy_count>0
    THEN 'HOLD_POLICY_CALLER_REVIEW_REQUIRED'
  ELSE 'REVIEW_ONLY_ALL_KNOWN_POLICY_CALLS_SESSION_BOUND_NO_DEPLOYMENT'
 END AS compatibility_gate
FROM facts;
