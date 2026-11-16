-- BUILD193: DISPOSABLE PG17 ONLY. Injected inside existing Build192
-- actual proposal transaction, before its unconditional ROLLBACK.
-- Synthetic roles/records, fixture-only auth.uid/has_role/is_approved bodies.
-- NOT real GoTrue JWTs, actual prod helper bodies, hosted UAT or approval.
\set ON_ERROR_STOP on

-- The Build73 snapshot has inert privileged helpers. Replace ONLY INSIDE
-- THIS NEVER-COMMITTED DISPOSABLE TRANSACTION with meaningful fixture logic.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=''
AS $fixture_uid$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$fixture_uid$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=''
AS $fixture_role$
 SELECT _user_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.user_roles u WHERE u.user_id=_user_id AND u.role=_role
 );
$fixture_role$;
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=''
AS $fixture_approval$
 SELECT _user_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.profiles p WHERE p.id=_user_id
 AND p.status='approved'::public.user_status AND p.is_active IS TRUE
 );
$fixture_approval$;
-- Only synthetic rows, created as postgres, never a hosted business row.
INSERT INTO public.profiles(id,status,is_active,full_name) VALUES
 ('11111111-1111-4111-8111-111111111111','approved',true,'fake admin'),
 ('22222222-2222-4222-8222-222222222222','approved',true,'fake recruiter A'),
 ('33333333-3333-4333-8333-333333333333','approved',true,'fake recruiter B'),
 ('44444444-4444-4444-8444-444444444444','approved',true,'fake finance'),
 ('55555555-5555-4555-8555-555555555555','pending',false,'fake unapproved admin');
INSERT INTO public.user_roles(id,user_id,role) VALUES
 ('a1000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','admin'),
 ('a1000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','recruiter'),
 ('a1000000-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333','recruiter'),
 ('a1000000-0000-4000-8000-000000000004','44444444-4444-4444-8444-444444444444','finance'),
 ('a1000000-0000-4000-8000-000000000005','55555555-5555-4555-8555-555555555555','admin');
INSERT INTO public.candidates(id,assigned_recruiter,stage,full_name) VALUES
 ('c1000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','lead_received','fictional candidate A'),
 ('c1000000-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','lead_received','fictional candidate B');
INSERT INTO public.job_openings(id,assigned_recruiter,job_title) VALUES
 ('d1000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','fictional job A'),
 ('d1000000-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','fictional job B');
INSERT INTO public.billing(id,invoice_number) VALUES
 ('b1000000-0000-4000-8000-000000000001','fictional invoice');
INSERT INTO public.audit_logs(id,action,table_name) VALUES
 ('e1000000-0000-4000-8000-000000000001','fictional_event','fictional_table');
INSERT INTO public.notifications(id,user_id,title,is_read) VALUES
 ('f1000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','fictional notification A',false),
 ('f1000000-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','fictional notification B',false);

-- Fictional related rows for cross-table policies that traverse candidates.
INSERT INTO public.submissions(id,candidate_uuid,status) VALUES
 ('61000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','submitted'),
 ('61000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','submitted');
INSERT INTO public.interviews(id,candidate_uuid,status) VALUES
 ('71000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','scheduled'),
 ('71000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','scheduled');
INSERT INTO public.candidate_stage_history(id,candidate_id,new_stage) VALUES
 ('81000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','submitted'),
 ('81000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','submitted');
INSERT INTO public.offers(id,candidate_uuid,offer_status) VALUES
 ('91000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','offered');
INSERT INTO public.clients(id,company_name) VALUES
 ('a2000000-0000-4000-8000-000000000001','fictional client');

-- API-role ACL denial for anon is important independent of policy predicates.
SELECT (
 NOT pg_catalog.has_table_privilege('anon','public.candidates','SELECT')
 AND NOT pg_catalog.has_table_privilege('anon','public.candidates','INSERT')
 AND NOT pg_catalog.has_table_privilege('anon','public.billing','SELECT')
 AND NOT pg_catalog.has_table_privilege('anon','public.audit_logs','SELECT')
 AND NOT pg_catalog.has_table_privilege('anon','public.user_roles','SELECT')
) AS b193_anon_acl_denied \gset
\if :b193_anon_acl_denied
 \echo 'BUILD193_ANON_PRIVATE_ACL_DENIED'
\else
 SELECT 1/0;
\endif

SET LOCAL ROLE authenticated;
-- Admin: 2 candidates + 2 jobs + 1 billing + 1 audit + all 5 role rows.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT (
 (SELECT count(*) FROM public.candidates)=2
 AND (SELECT count(*) FROM public.job_openings)=2
 AND (SELECT count(*) FROM public.billing)=1
 AND (SELECT count(*) FROM public.audit_logs)=1
 AND (SELECT count(*) FROM public.user_roles)=5
 AND (SELECT count(*) FROM public.profiles)=5
 AND (SELECT count(*) FROM public.submissions)=2
 AND (SELECT count(*) FROM public.interviews)=2
 AND (SELECT count(*) FROM public.candidate_stage_history)=2
 AND (SELECT count(*) FROM public.offers)=1
 AND (SELECT count(*) FROM public.clients)=1
) AS b193_admin_reads \gset
\if :b193_admin_reads
 \echo 'BUILD193_ADMIN_APPROVED_READ_MATRIX_PASS'
\else
 SELECT 1/0;
\endif

-- Recruiter A: sees own assigned candidate/job and own notification/role,
-- but not other recruiter, billing or audit.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT (
 (SELECT count(*) FROM public.candidates)=1
 AND EXISTS(SELECT 1 FROM public.candidates WHERE id='c1000000-0000-4000-8000-000000000001')
 AND NOT EXISTS(SELECT 1 FROM public.candidates WHERE id='c1000000-0000-4000-8000-000000000002')
 AND (SELECT count(*) FROM public.job_openings)=1
 AND (SELECT count(*) FROM public.billing)=0
 AND (SELECT count(*) FROM public.audit_logs)=0
 AND (SELECT count(*) FROM public.notifications)=1
 AND (SELECT count(*) FROM public.user_roles)=1
 AND (SELECT count(*) FROM public.submissions)=1
 AND (SELECT count(*) FROM public.interviews)=1
 AND (SELECT count(*) FROM public.candidate_stage_history)=1
 AND (SELECT count(*) FROM public.offers)=0
 AND (SELECT count(*) FROM public.clients)=0
) AS b193_recruiter_a_reads \gset
\if :b193_recruiter_a_reads
 \echo 'BUILD193_RECRUITER_A_ROW_ISOLATION_PASS'
\else
 SELECT 1/0;
\endif

-- Recruiter A approved INSERT of own candidate, but row re-assignment
-- or insertion to recruiter's B ownership must fail with RLS violation.
INSERT INTO public.candidates(id,assigned_recruiter,stage)
 VALUES('c1000000-0000-4000-8000-000000000003',
 '22222222-2222-4222-8222-222222222222','contacted');
SELECT ((SELECT count(*) FROM public.candidates)=2) AS b193_own_insert \gset
\if :b193_own_insert
 \echo 'BUILD193_RECRUITER_OWN_CANDIDATE_INSERT_PASS'
\else
 SELECT 1/0;
\endif
DO $denied$
BEGIN
 BEGIN
  INSERT INTO public.candidates(id,assigned_recruiter)
   VALUES('c1000000-0000-4000-8000-000000000004',
   '33333333-3333-4333-8333-333333333333');
  RAISE EXCEPTION 'BUILD193_FAIL: cross-recruiter candidate insert succeeded';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'BUILD193_CROSS_RECRUITER_CANDIDATE_INSERT_DENIED';
 END;
END $denied$;
-- A can change authorized stage, not assigned recruiter column.
UPDATE public.candidates SET stage='contacted' WHERE
 id='c1000000-0000-4000-8000-000000000001';
SELECT (SELECT stage='contacted' FROM public.candidates
 WHERE id='c1000000-0000-4000-8000-000000000001') AS b193_stage_update \gset
\if :b193_stage_update
 \echo 'BUILD193_RECRUITER_ALLOWLISTED_STAGE_UPDATE_PASS'
\else
 SELECT 1/0;
\endif
DO $denied$
BEGIN
 BEGIN
  UPDATE public.candidates
   SET assigned_recruiter='33333333-3333-4333-8333-333333333333'
   WHERE id='c1000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'BUILD193_FAIL: recruiter changed candidate owner';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'BUILD193_CANDIDATE_OWNER_COLUMN_UPDATE_DENIED';
 END;
END $denied$;

-- The recipient may mark their own notification read, but may not
-- rewrite its recipient or another recruiter's notification.
UPDATE public.notifications SET is_read=true
 WHERE id='f1000000-0000-4000-8000-000000000001';
SELECT (SELECT is_read FROM public.notifications WHERE
 id='f1000000-0000-4000-8000-000000000001') AS b193_mark_read \gset
\if :b193_mark_read
 \echo 'BUILD193_OWN_NOTIFICATION_MARK_READ_ALLOWED'
\else
 SELECT 1/0;
\endif
DO $denied$
BEGIN
 BEGIN
  UPDATE public.notifications
  SET user_id='33333333-3333-4333-8333-333333333333'
  WHERE id='f1000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'BUILD193_FAIL: notification recipient mutated';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'BUILD193_NOTIFICATION_RECIPIENT_UPDATE_DENIED';
 END;
END $denied$;
SELECT (
 (SELECT count(*) FROM public.submissions)=1
 AND (SELECT count(*) FROM public.interviews)=1
 AND (SELECT count(*) FROM public.candidate_stage_history)=1
 AND (SELECT count(*) FROM public.offers)=0
) AS b193_related_scopes \gset
\if :b193_related_scopes
 \echo 'BUILD193_RECRUITER_RELATED_RECORD_ISOLATION_PASS'
\else
 SELECT 1/0;
\endif
-- Recruiter must not use admin-only submission write path.
DO $denied$
BEGIN
 BEGIN
  INSERT INTO public.submissions(id,candidate_uuid)
   VALUES('61000000-0000-4000-8000-000000000003',
   'c1000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'BUILD193_FAIL: recruiter inserted admin-only submission';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'BUILD193_RECRUITER_SUBMISSION_WRITE_DENIED';
 END;
END $denied$;

-- Recruiter B must be isolated from A, even after A inserted another row.
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT (
 (SELECT count(*) FROM public.candidates)=1
 AND EXISTS(SELECT 1 FROM public.candidates WHERE id='c1000000-0000-4000-8000-000000000002')
 AND (SELECT count(*) FROM public.job_openings)=1
 AND (SELECT count(*) FROM public.notifications)=1
 AND (SELECT count(*) FROM public.billing)=0
 AND (SELECT count(*) FROM public.audit_logs)=0
 AND (SELECT count(*) FROM public.submissions)=1
 AND (SELECT count(*) FROM public.interviews)=1
 AND (SELECT count(*) FROM public.candidate_stage_history)=1
 AND (SELECT count(*) FROM public.offers)=0
) AS b193_recruiter_b_reads \gset
\if :b193_recruiter_b_reads
 \echo 'BUILD193_RECRUITER_B_ROW_ISOLATION_PASS'
\else
 SELECT 1/0;
\endif

-- Approved finance can inspect billing but not candidate, job or audit rows.
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
SELECT (
 (SELECT count(*) FROM public.billing)=1
 AND (SELECT count(*) FROM public.candidates)=0
 AND (SELECT count(*) FROM public.job_openings)=0
 AND (SELECT count(*) FROM public.audit_logs)=0
 AND (SELECT count(*) FROM public.user_roles)=1
 AND (SELECT count(*) FROM public.submissions)=0
 AND (SELECT count(*) FROM public.interviews)=0
 AND (SELECT count(*) FROM public.offers)=0
 AND (SELECT count(*) FROM public.clients)=0
) AS b193_finance_read \gset
\if :b193_finance_read
 \echo 'BUILD193_FINANCE_BILLING_ONLY_PASS'
\else
 SELECT 1/0;
\endif

-- A formally pending user holding a fake admin role must not get approved
-- application data even if their self profile/role can be read.
SELECT set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
SELECT (
 (SELECT count(*) FROM public.candidates)=0
 AND (SELECT count(*) FROM public.job_openings)=0
 AND (SELECT count(*) FROM public.billing)=0
 AND (SELECT count(*) FROM public.audit_logs)=0
 AND (SELECT count(*) FROM public.profiles)=1
 AND (SELECT count(*) FROM public.user_roles)=1
) AS b193_pending_admin \gset
\if :b193_pending_admin
 \echo 'BUILD193_PENDING_ADMIN_DATA_DENIED_PASS'
\else
 SELECT 1/0;
\endif

SELECT set_config('request.jwt.claim.sub','',true);
SELECT (
 (SELECT count(*) FROM public.candidates)=0
 AND (SELECT count(*) FROM public.job_openings)=0
 AND (SELECT count(*) FROM public.billing)=0
 AND (SELECT count(*) FROM public.audit_logs)=0
) AS b193_no_subject \gset
\if :b193_no_subject
 \echo 'BUILD193_AUTHENTICATED_DB_ROLE_WITHOUT_SUBJECT_DENIED'
\else
 SELECT 1/0;
\endif

RESET ROLE;
\echo 'BUILD193_REAL_35_POLICY_BEHAVIOR_TESTS_COMPLETE_DISPOSABLE_ONLY'
