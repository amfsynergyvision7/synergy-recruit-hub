-- Exact ORIGINAL baseline followed by exact ORIGINAL relationship migration (twice).
-- Isolated synthetic PostgreSQL only. No operational candidate/billing records.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $roles$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS 'SELECT ''00000000-0000-0000-0000-000000000001''::uuid';
\ir ../../supabase/migrations/20260512131020_8bd78994-f2ec-4e2b-a8f1-6838de651c80.sql
INSERT INTO auth.users (id,email) VALUES
 ('00000000-0000-0000-0000-000000000001','synthetic-user@example.invalid');
INSERT INTO public.clients(id,company_name) VALUES
 ('00000000-0000-0000-0000-000000000002','Synthetic Client');
INSERT INTO public.job_openings(id,client_id,job_title) VALUES
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','Synthetic Role');
INSERT INTO public.candidates(id,full_name,assigned_recruiter,expected_salary) VALUES
 ('00000000-0000-0000-0000-000000000003','Synthetic Candidate','00000000-0000-0000-0000-000000000001',100000);
INSERT INTO public.submissions(id,candidate_id,client_id,job_id) VALUES
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004');
INSERT INTO public.interviews(id,candidate_id,client_id,status) VALUES
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002','selected');
INSERT INTO public.offers(id,candidate_id,client_id,salary,joining_status) VALUES
 ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',100000,'joined');
INSERT INTO public.billing(id,candidate_id,client_id,salary) VALUES
 ('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',100000);
-- Full original migration SQL (not extracted statements or synthetic rewrite).
\ir ../../supabase/migrations/20260513091605_0748e094-a67e-47ca-a5a5-0040593d766f.sql
DO $check$
BEGIN
 IF (SELECT client_uuid FROM public.job_openings LIMIT 1)<>'00000000-0000-0000-0000-000000000002'::uuid OR
    (SELECT candidate_uuid FROM public.submissions LIMIT 1)<>'00000000-0000-0000-0000-000000000003'::uuid OR
    (SELECT job_uuid FROM public.submissions LIMIT 1)<>'00000000-0000-0000-0000-000000000004'::uuid OR
    (SELECT submission_uuid FROM public.interviews LIMIT 1)<>'00000000-0000-0000-0000-000000000005'::uuid OR
    (SELECT interview_uuid FROM public.offers LIMIT 1)<>'00000000-0000-0000-0000-000000000006'::uuid OR
    (SELECT submission_uuid FROM public.offers LIMIT 1)<>'00000000-0000-0000-0000-000000000005'::uuid OR
    (SELECT offer_uuid FROM public.billing LIMIT 1)<>'00000000-0000-0000-0000-000000000007'::uuid THEN
  RAISE EXCEPTION 'Original relationship backfill did not link unique synthetic records'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='offers_stage_billing_trigger' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'Original offer-to-billing automation trigger missing'; END IF;
END $check$;
-- Original source is designed with IF NOT EXISTS and DROP/CREATE guards.
\ir ../../supabase/migrations/20260513091605_0748e094-a67e-47ca-a5a5-0040593d766f.sql
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.billing)<>1 THEN
  RAISE EXCEPTION 'Original second relationship replay duplicated synthetic billing'; END IF;
END $check$;
-- Verify the actual installed trigger on a SECOND synthetic candidate/offer.
INSERT INTO public.candidates(id,full_name,assigned_recruiter,expected_salary) VALUES
 ('00000000-0000-0000-0000-000000000009','Synthetic Second Candidate',
  '00000000-0000-0000-0000-000000000001',100000);
INSERT INTO public.offers(id,candidate_id,salary,joining_status) VALUES
 ('00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000009',100000,'pending');
UPDATE public.offers SET joining_status='joined'
WHERE id='00000000-0000-0000-0000-000000000010';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.billing)<>2 THEN
  RAISE EXCEPTION 'Original joined-offer trigger failed to produce one new synthetic bill'; END IF;
 IF (SELECT count(*) FROM public.billing WHERE offer_uuid='00000000-0000-0000-0000-000000000010'::uuid
     AND placement_fee=8330 AND invoice_amount=9829.40)<>1 THEN
  RAISE EXCEPTION 'Original joined-offer financial calculation or offer linkage differs'; END IF;
END $check$;
ROLLBACK;
DO $check$
BEGIN
 IF to_regclass('public.billing') IS NOT NULL OR to_regclass('public.submissions') IS NOT NULL THEN
  RAISE EXCEPTION 'Original relationship fixture survived rollback'; END IF;
END $check$;
SELECT 'PASS: exact original relationship migration twice with baseline auth dependency, backfill, synthetic billing and rollback' AS result;
