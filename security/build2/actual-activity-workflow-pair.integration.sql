-- Two ORIGINAL SQL migrations executed against disposable synthetic PostgreSQL only.
-- Activity migration is intentionally replayed twice; configurable workflows has
-- a non-idempotent CREATE TABLE and is applied once. All changes roll back.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT ''00000000-0000-0000-0000-000000000001''::uuid';
CREATE FUNCTION public.is_approved(u uuid) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT u IS NOT NULL';
CREATE FUNCTION public.has_role(u uuid, r text) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT u IS NOT NULL AND r = ''admin''';
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $updated$
BEGIN NEW.updated_at:=now(); RETURN NEW; END;
$updated$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text);
CREATE TABLE public.user_roles (user_id uuid, role text);
CREATE TABLE public.clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_name text NOT NULL);
CREATE TABLE public.candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text NOT NULL,
 assigned_recruiter uuid, stage text, position_applied text, notes text,
 expected_salary numeric, current_salary numeric, updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), candidate_uuid uuid, candidate_id uuid,
 client_uuid uuid, role_title text, submission_date date, status text,
 remarks text, created_by uuid
);
CREATE TABLE public.interviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), candidate_uuid uuid, candidate_id uuid,
 client_uuid uuid, round text, interview_date date, status text, mode text, created_by uuid
);
CREATE TABLE public.offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), candidate_uuid uuid, candidate_id uuid,
 client_uuid uuid, offer_date date, offer_status text, joining_status text,
 salary numeric, ctc numeric, created_by uuid
);
CREATE TABLE public.billing (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), candidate_uuid uuid, candidate_id uuid,
 client_uuid uuid, invoice_date date, salary numeric, placement_fee numeric, gst numeric,
 invoice_amount numeric, outstanding_amount numeric, payment_status text, created_by uuid
);
CREATE TABLE public.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, message text,
 type text, related_table text, related_id uuid,
 UNIQUE (related_table,related_id,type)
);
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.profiles VALUES ('00000000-0000-0000-0000-000000000001','Synthetic Reviewer');
INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-000000000001','admin');
-- Test exact original SQL, not a reimplementation.
\ir ../../supabase/migrations/20260517054652_a336ca88-33cd-4bcd-8117-8af35eb851db.sql
\ir ../../supabase/migrations/20260517054652_a336ca88-33cd-4bcd-8117-8af35eb851db.sql
\ir ../../supabase/migrations/20260930060000_workflow_rules.sql
DO $check$
BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE tgname='workflow_rules_trigger' AND NOT tgisinternal)<>6 THEN
  RAISE EXCEPTION 'Original configurable workflow triggers not installed on six synthetic tables'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE tablename='candidate_activities')<>2 THEN
  RAISE EXCEPTION 'Original activity policies missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='workflow_rules' AND policyname='admin manage workflow rules') THEN
  RAISE EXCEPTION 'Original admin workflow policy missing'; END IF;
END $check$;
INSERT INTO public.workflow_rules
(name,table_name,field_name,field_value,action_type,notify_target,notify_title,notify_message,created_by)
VALUES
('synthetic joined alert','candidates','stage','joined','notify','assigned_recruiter','Joined: {{full_name}}','Synthetic stage {{value}}','00000000-0000-0000-0000-000000000001'),
('synthetic field edit','candidates','stage','submitted_to_client','update_field',NULL,NULL,NULL,'00000000-0000-0000-0000-000000000001');
UPDATE public.workflow_rules SET update_field_name='position_applied',update_field_value='SYNTHETIC_UPDATED' WHERE name='synthetic field edit';
INSERT INTO public.candidates (id,full_name,assigned_recruiter,stage,position_applied,expected_salary)
VALUES ('00000000-0000-0000-0000-000000000002','Synthetic Candidate','00000000-0000-0000-0000-000000000001','lead_received','SYNTHETIC_ROLE',100000);
UPDATE public.candidates SET stage='submitted_to_client' WHERE id='00000000-0000-0000-0000-000000000002';
UPDATE public.candidates SET stage='interview_scheduled' WHERE id='00000000-0000-0000-0000-000000000002';
UPDATE public.candidates SET stage='offer_released' WHERE id='00000000-0000-0000-0000-000000000002';
UPDATE public.candidates SET stage='joined' WHERE id='00000000-0000-0000-0000-000000000002';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.submissions)<>1 OR
    (SELECT count(*) FROM public.interviews)<>1 OR
    (SELECT count(*) FROM public.offers)<>1 OR
    (SELECT count(*) FROM public.billing)<>1 THEN
  RAISE EXCEPTION 'Original stage automation did not produce one of each synthetic downstream records'; END IF;
 IF (SELECT count(*) FROM public.candidate_activities WHERE action_type='stage_change')<>4 OR
    EXISTS (SELECT 1 FROM public.candidate_activities WHERE action_type='automation_error') THEN
  RAISE EXCEPTION 'Original activity timeline is incomplete or contains swallowed automation errors'; END IF;
 IF (SELECT position_applied FROM public.candidates LIMIT 1)<>'SYNTHETIC_UPDATED' THEN
  RAISE EXCEPTION 'Original dynamic same-record update_field workflow did not execute'; END IF;
 IF (SELECT count(*) FROM public.notifications WHERE type LIKE 'workflow:%')<>1 THEN
  RAISE EXCEPTION 'Original notification workflow failed or duplicated'; END IF;
 IF (SELECT placement_fee FROM public.billing LIMIT 1)<>8330 OR
    (SELECT gst FROM public.billing LIMIT 1)<>1499.40 OR
    (SELECT invoice_amount FROM public.billing LIMIT 1)<>9829.40 THEN
  RAISE EXCEPTION 'Synthetic financial calculation does not match ORIGINAL activity trigger'; END IF;
END $check$;
ROLLBACK;
DO $check$
BEGIN
 IF to_regclass('public.candidate_activities') IS NOT NULL OR
    to_regclass('public.workflow_rules') IS NOT NULL OR
    to_regclass('public.billing') IS NOT NULL THEN
  RAISE EXCEPTION 'Synthetic original-migration fixture survived rollback'; END IF;
END $check$;
SELECT 'PASS: two original migrations, activity twice and workflow once, with synthetic side effects and rollback' AS result;
