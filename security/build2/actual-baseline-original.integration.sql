-- Full original baseline schema migration, first application only, on an empty disposable DB.
-- Synthetic auth-owned user contract. No operational users, records or services.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
 id uuid PRIMARY KEY,
 email text NOT NULL,
 raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $roles$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS 'SELECT ''00000000-0000-0000-0000-000000000001''::uuid';
-- Execute exact ORIGINAL SQL once; enum/table/policy DDL intentionally is not idempotent.
\ir ../../supabase/migrations/20260512131020_8bd78994-f2ec-4e2b-a8f1-6838de651c80.sql
DO $check$
DECLARE
 n_tables int;
BEGIN
 SELECT count(*) INTO n_tables FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
 ('profiles','user_roles','clients','job_openings','candidates','submissions',
  'interviews','offers','billing','notifications','audit_logs');
 IF n_tables<>11 THEN RAISE EXCEPTION 'Original baseline missing synthetic application tables: %',n_tables; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public')<>39 THEN
  RAISE EXCEPTION 'Original baseline RLS policy count differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'Original auth user provisioning trigger missing'; END IF;
END $check$;
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES('00000000-0000-0000-0000-000000000001','synthetic-viewer@example.invalid',
 '{"full_name":"Synthetic Reviewer"}');
DO $check$
BEGIN
 IF (SELECT status::text FROM public.profiles LIMIT 1)<>'pending' OR
    (SELECT role::text FROM public.user_roles LIMIT 1)<>'viewer' THEN
  RAISE EXCEPTION 'Original baseline synthetic auth provisioning/role boundary differs'; END IF;
END $check$;
INSERT INTO public.clients(id,company_name) VALUES
 ('00000000-0000-0000-0000-000000000002','Synthetic Client');
INSERT INTO public.candidates(id,full_name,assigned_recruiter,expected_salary)
VALUES('00000000-0000-0000-0000-000000000003','Synthetic Candidate',
       '00000000-0000-0000-0000-000000000001',100000);
INSERT INTO public.submissions(candidate_id,client_id,role_title)
VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Synthetic Role');
INSERT INTO public.interviews(candidate_id,client_id,round,status)
VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','screening','scheduled');
INSERT INTO public.offers(id,candidate_id,client_id,salary,offer_status,joining_status)
VALUES('00000000-0000-0000-0000-000000000004',
       '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',
       100000,'released','pending');
UPDATE public.offers SET joining_status='joined'
WHERE id='00000000-0000-0000-0000-000000000004';
INSERT INTO public.billing(candidate_id,client_id,salary,invoice_amount)
VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',100000,10000);
DO $check$
BEGIN
 IF (SELECT stage::text FROM public.candidates LIMIT 1)<>'joined' THEN
  RAISE EXCEPTION 'Original submission, interview or offer stage trigger failed'; END IF;
 IF (SELECT candidate_code FROM public.candidates LIMIT 1) NOT LIKE 'CAND-%' THEN
  RAISE EXCEPTION 'Original candidate code trigger failed'; END IF;
 IF (SELECT invoice_number FROM public.billing LIMIT 1) NOT LIKE 'INV-%' THEN
  RAISE EXCEPTION 'Original invoice number trigger failed'; END IF;
 IF (SELECT count(*) FROM public.billing)<>1 THEN
  RAISE EXCEPTION 'Original billing unexpectedly generated extra synthetic records'; END IF;
END $check$;
ROLLBACK;
DO $check$
BEGIN
 IF to_regclass('public.candidates') IS NOT NULL OR
    to_regclass('public.billing') IS NOT NULL OR
    to_regclass('auth.users') IS NOT NULL THEN
  RAISE EXCEPTION 'Original baseline schema or auth fixture survived rollback'; END IF;
END $check$;
SELECT 'PASS: original baseline first application, auth/RLS/stage/billing constraints, full rollback' AS result;
