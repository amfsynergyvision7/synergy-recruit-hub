-- Build75: disposable PostgreSQL 17 only, deliberately NOT a hosted Auth mutation.
-- Simulates the observed autoprofile/auth role trigger mechanics WITHOUT the production function
-- body or its hardcoded privileged email. Tests hook isolation and nine synthetic role slots.
BEGIN;
SET LOCAL statement_timeout='60s';
DO $guard$
BEGIN
 IF current_database()<>'amf_build75_auth_lab' THEN
  RAISE EXCEPTION 'Build75 refuses non-disposable PostgreSQL database';
 END IF;
END $guard$;
CREATE SCHEMA auth;
CREATE TYPE public.user_status AS ENUM ('pending','approved','rejected','suspended');
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.candidate_stage AS ENUM ('lead_received','contacted','interested','resume_collected','submitted_to_client','interview_scheduled','interview_completed','selected','offer_released','joined','rejected','dropped');
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text NOT NULL);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,email text,status public.user_status,is_active boolean);
CREATE TABLE public.user_roles(user_id uuid PRIMARY KEY,role public.app_role);
CREATE TABLE public.candidates(id uuid PRIMARY KEY,assigned_recruiter uuid,stage public.candidate_stage);
-- This synthetic helper models ONLY the observed structural side effect of the production
-- auth hook; it never includes or executes its source, bootstrap email or real business logic.
CREATE FUNCTION public.synthetic_auth_autoprofile() RETURNS trigger LANGUAGE plpgsql AS $stub$
BEGIN
 INSERT INTO public.profiles(id,email,status,is_active)
 VALUES (NEW.id,NEW.email,'pending',false);
 INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'viewer');
 RETURN NEW;
END $stub$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.synthetic_auth_autoprofile();
SAVEPOINT active_hook_example;
INSERT INTO auth.users(id,email) VALUES ('88888888-8888-4888-8888-888888888888','synthetic-negative@example.invalid');
DO $unsafe$
BEGIN
 IF (SELECT count(*) FROM public.profiles WHERE id='88888888-8888-4888-8888-888888888888')<>1 OR
 (SELECT count(*) FROM public.user_roles WHERE user_id='88888888-8888-4888-8888-888888888888')<>1 THEN
  RAISE EXCEPTION 'Active auth hook did not automatically profile/role the ninth synthetic user';
 END IF;
END $unsafe$;
ROLLBACK TO SAVEPOINT active_hook_example;
-- Purely disposable lab isolation: disabling the *simulated* auth trigger preserves an
-- unprofiled ninth GoTrue-shaped user. NEVER run ALTER auth.users in a hosted project.
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
INSERT INTO auth.users(id,email) VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','synthetic-slot-01@example.invalid'),
 ('11111111-1111-4111-8111-111111111111','synthetic-slot-02@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','synthetic-slot-03@example.invalid'),
 ('33333333-3333-4333-8333-333333333333','synthetic-slot-04@example.invalid'),
 ('44444444-4444-4444-8444-444444444444','synthetic-slot-05@example.invalid'),
 ('55555555-5555-4555-8555-555555555555','synthetic-slot-06@example.invalid'),
 ('66666666-6666-4666-8666-666666666666','synthetic-slot-07@example.invalid'),
 ('77777777-7777-4777-8777-777777777777','synthetic-slot-08@example.invalid'),
 ('88888888-8888-4888-8888-888888888888','synthetic-slot-09@example.invalid');
INSERT INTO public.profiles(id,email,status,is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','synthetic-slot-01@example.invalid','approved',true),
 ('11111111-1111-4111-8111-111111111111','synthetic-slot-02@example.invalid','approved',true),
 ('22222222-2222-4222-8222-222222222222','synthetic-slot-03@example.invalid','approved',true),
 ('33333333-3333-4333-8333-333333333333','synthetic-slot-04@example.invalid','approved',true),
 ('44444444-4444-4444-8444-444444444444','synthetic-slot-05@example.invalid','approved',true),
 ('55555555-5555-4555-8555-555555555555','synthetic-slot-06@example.invalid','pending',true),
 ('66666666-6666-4666-8666-666666666666','synthetic-slot-07@example.invalid','approved',false),
 ('77777777-7777-4777-8777-777777777777','synthetic-slot-08@example.invalid','approved',true);
INSERT INTO public.user_roles(user_id,role) VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),
 ('11111111-1111-4111-8111-111111111111','recruiter'),
 ('22222222-2222-4222-8222-222222222222','recruiter'),
 ('33333333-3333-4333-8333-333333333333','finance'),
 ('44444444-4444-4444-8444-444444444444','operations'),
 ('55555555-5555-4555-8555-555555555555','recruiter'),
 ('66666666-6666-4666-8666-666666666666','recruiter'),
 ('77777777-7777-4777-8777-777777777777','viewer');
INSERT INTO public.candidates(id,assigned_recruiter,stage) VALUES
 ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','lead_received'),
 ('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','lead_received');
CREATE TEMP VIEW b75_postseed_probe AS
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
DO $pass$
DECLARE g record;
BEGIN
 SELECT * INTO g FROM b75_postseed_probe;
 IF g.postseed_gate<>'HOSTED_SYNTHETIC_FIXTURE_CONSISTENT_NOT_FORMAL_AUTH_ACCEPTANCE'
 OR g.auth_users<>9 OR g.profile_rows<>8 OR g.user_role_rows<>8
 OR g.auth_without_profile_and_role<>1 OR g.candidate_rows<>2 OR
 g.correctly_owned_safe_candidate_rows<>2 THEN
  RAISE EXCEPTION 'Build75 approved synthetic role fixture test failed: %',row_to_json(g);
 END IF;
END $pass$;
-- NEGATIVE: auth hook or rogue seed accidentally creates a profile/role for ninth identity.
SAVEPOINT invalid_ninth;
INSERT INTO public.profiles(id,email,status,is_active)
 VALUES ('88888888-8888-4888-8888-888888888888','synthetic-negative@example.invalid','approved',true);
INSERT INTO public.user_roles(user_id,role) VALUES ('88888888-8888-4888-8888-888888888888','viewer');
DO $fail_profile$
DECLARE status text;
BEGIN
 SELECT postseed_gate INTO status FROM b75_postseed_probe;
 IF status<>'HOLD_HOSTED_FIXTURE_ROLE_PROFILE_OWNER_INTEGRITY' THEN
  RAISE EXCEPTION 'Unexpectedly accepted a profiled ninth synthetic identity'; END IF;
END $fail_profile$;
ROLLBACK TO SAVEPOINT invalid_ninth;
-- NEGATIVE: candidate ownership changes to synthetic finance instead of approved recruiter.
SAVEPOINT invalid_owner;
UPDATE public.candidates SET assigned_recruiter='33333333-3333-4333-8333-333333333333' WHERE id='11111111-1111-4111-8111-111111111111';
DO $fail_owner$
DECLARE status text;
BEGIN
 SELECT postseed_gate INTO status FROM b75_postseed_probe;
 IF status<>'HOLD_HOSTED_FIXTURE_ROLE_PROFILE_OWNER_INTEGRITY' THEN
  RAISE EXCEPTION 'Unexpectedly accepted finance-owned synthetic recruiter candidate'; END IF;
END $fail_owner$;
ROLLBACK TO SAVEPOINT invalid_owner;
-- NEGATIVE: reject a non-invented email domain without revealing any email value.
SAVEPOINT invalid_domain;
UPDATE auth.users SET email='invalid-domain@example.com' WHERE id='11111111-1111-4111-8111-111111111111';
DO $fail_domain$
DECLARE status text;
BEGIN
 SELECT postseed_gate INTO status FROM b75_postseed_probe;
 IF status<>'HOLD_HOSTED_FIXTURE_ROLE_PROFILE_OWNER_INTEGRITY' THEN
  RAISE EXCEPTION 'Unexpectedly accepted non-synthetic account domain'; END IF;
END $fail_domain$;
ROLLBACK TO SAVEPOINT invalid_domain;
DO $recheck$
DECLARE status text;
BEGIN
 SELECT postseed_gate INTO status FROM b75_postseed_probe;
 IF status<>'HOSTED_SYNTHETIC_FIXTURE_CONSISTENT_NOT_FORMAL_AUTH_ACCEPTANCE' THEN
  RAISE EXCEPTION 'Safe fixture not restored after negative rollback'; END IF;
END $recheck$;
ROLLBACK;
