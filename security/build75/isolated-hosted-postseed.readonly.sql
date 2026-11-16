-- Build75 POST-SEED READ ONLY — run ONLY after separately approved synthetic-only nonprod setup.
-- Never run against production/staging. No personal/credential/row exports: one aggregate-only result.
-- Requires exactly nine invented GoTrue identities using example.invalid, eight profiles/roles,
-- one deliberately unprofiled and unroled ninth, and two correct synthetic candidate owner rows.
WITH expected_role_groups(role_name,status_name,is_active,expected_count) AS (VALUES
 ('admin','approved',true,1),
 ('recruiter','approved',true,2),
 ('recruiter','pending',true,1),
 ('recruiter','approved',false,1),
 ('finance','approved',true,1),
 ('operations','approved',true,1),
 ('viewer','approved',true,1)
), actual_groups AS (
 SELECT r.role::text AS role_name,p.status::text AS status_name,p.is_active,
 count(*)::bigint AS actual_count
 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
 GROUP BY r.role::text,p.status::text,p.is_active
), group_mismatches AS (
 SELECT e.role_name,e.status_name,e.is_active,e.expected_count,
 coalesce(a.actual_count,0) AS actual_count
 FROM expected_role_groups e LEFT JOIN actual_groups a
 ON a.role_name=e.role_name AND a.status_name=e.status_name
 AND a.is_active=e.is_active
 UNION ALL
 SELECT a.role_name,a.status_name,a.is_active,0,a.actual_count
 FROM actual_groups a LEFT JOIN expected_role_groups e
 ON a.role_name=e.role_name AND a.status_name=e.status_name AND a.is_active=e.is_active
 WHERE e.role_name IS NULL
), totals AS (
 SELECT
 (SELECT count(*) FROM auth.users) AS auth_users,
 (SELECT count(*) FROM auth.users WHERE email IS NULL OR
   lower(split_part(email,'@',2))<>'example.invalid') AS non_synthetic_email_domains,
 (SELECT count(*) FROM public.profiles) AS profile_rows,
 (SELECT count(*) FROM public.user_roles) AS user_role_rows,
 (SELECT count(*) FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
  LEFT JOIN public.user_roles r ON r.user_id=u.id
  WHERE p.id IS NULL AND r.user_id IS NULL) AS auth_without_profile_and_role,
 (SELECT count(*) FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
  LEFT JOIN public.user_roles r ON r.user_id=u.id
  WHERE (p.id IS NULL)<>(r.user_id IS NULL)) AS partially_profiled_auth_users,
 (SELECT count(*) FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.id
  WHERE u.id IS NULL) AS orphan_profiles,
 (SELECT count(*) FROM public.user_roles r LEFT JOIN auth.users u ON u.id=r.user_id
  WHERE u.id IS NULL) AS orphan_roles,
 (SELECT count(*) FROM group_mismatches WHERE expected_count<>actual_count) AS role_status_group_mismatches,
 (SELECT count(*) FROM public.candidates) AS candidate_rows,
 (SELECT count(*) FROM public.candidates c JOIN public.profiles p ON p.id=c.assigned_recruiter
  JOIN public.user_roles r ON r.user_id=p.id
  WHERE c.id=c.assigned_recruiter AND r.role::text='recruiter'
   AND p.status::text='approved' AND p.is_active
   AND c.stage::text NOT IN ('joined','offer_released')) AS correctly_owned_safe_candidate_rows
)
SELECT *,
 CASE WHEN auth_users=9 AND non_synthetic_email_domains=0
 AND profile_rows=8 AND user_role_rows=8
 AND auth_without_profile_and_role=1 AND partially_profiled_auth_users=0
 AND orphan_profiles=0 AND orphan_roles=0 AND role_status_group_mismatches=0
 AND candidate_rows=2 AND correctly_owned_safe_candidate_rows=2
 THEN 'HOSTED_SYNTHETIC_FIXTURE_CONSISTENT_NOT_FORMAL_AUTH_ACCEPTANCE'
 ELSE 'HOLD_HOSTED_FIXTURE_ROLE_PROFILE_OWNER_INTEGRITY'
 END AS postseed_gate
FROM totals;
