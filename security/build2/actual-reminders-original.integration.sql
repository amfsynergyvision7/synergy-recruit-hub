-- Exact original reminder migration on disposable synthetic PostgreSQL only.
-- cron.schedule is an inert, local stub recording the requested schedule:
-- pg_cron execution is NOT verified here and NO hourly job is activated.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA cron;
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $roles$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS 'SELECT ''00000000-0000-0000-0000-000000000001''::uuid';
CREATE TABLE cron.synthetic_jobs (
 name text PRIMARY KEY, schedule text NOT NULL, command text NOT NULL
);
CREATE FUNCTION cron.schedule(job_name text, schedule_text text, command_text text)
RETURNS bigint LANGUAGE plpgsql AS $cron$
BEGIN
 INSERT INTO cron.synthetic_jobs(name,schedule,command)
 VALUES(job_name,schedule_text,command_text)
 ON CONFLICT(name) DO UPDATE SET schedule=EXCLUDED.schedule,command=EXCLUDED.command;
 RETURN 1;
END $cron$;
CREATE TABLE public.candidates (
 id uuid PRIMARY KEY, assigned_recruiter uuid, full_name text,
 stage text, updated_at timestamptz NOT NULL
);
CREATE TABLE public.interviews (
 id uuid PRIMARY KEY, candidate_id uuid, round text, interview_date date,
 interview_time time, status text
);
CREATE TABLE public.offers (
 id uuid PRIMARY KEY, candidate_id uuid, joining_status text, joining_date date
);
CREATE TABLE public.billing (
 id uuid PRIMARY KEY, invoice_number text, outstanding_amount numeric,
 invoice_date date, payment_status text
);
CREATE TABLE public.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text,
 message text, type text, created_at timestamptz DEFAULT now()
);
INSERT INTO public.candidates(id,assigned_recruiter,full_name,stage,updated_at)
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Synthetic Candidate','contacted',now()-interval '9 days');
INSERT INTO public.interviews VALUES
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000002',
  'screening',(now() AT TIME ZONE 'Asia/Kolkata')::date+1,'10:00:00','scheduled');
INSERT INTO public.offers VALUES
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002',
  'pending',(now() AT TIME ZONE 'Asia/Kolkata')::date);
INSERT INTO public.billing VALUES
 ('00000000-0000-0000-0000-000000000031','SYNTHETIC-INV-001',10000,
  (now() AT TIME ZONE 'Asia/Kolkata')::date-20,'unpaid');
\ir ../../supabase/migrations/20260929060000_reminder_automation.sql
DO $verify$
BEGIN
 IF (SELECT count(*) FROM cron.synthetic_jobs WHERE name='generate-reminders-hourly'
     AND schedule='0 * * * *' AND command LIKE '%public.generate_reminders()%')<>1 THEN
  RAISE EXCEPTION 'Original hourly scheduling request was not captured by the inert cron shim'; END IF;
 IF (SELECT count(*) FROM public.notifications)<>4 OR
    (SELECT count(DISTINCT type) FROM public.notifications)<>4 THEN
  RAISE EXCEPTION 'Original first-application reminder seeding did not generate all four types'; END IF;
 IF (SELECT count(*) FROM public.notifications WHERE type='payment_overdue' AND user_id IS NULL)<>1 THEN
  RAISE EXCEPTION 'Original overdue payment broadcast behavior differs'; END IF;
END $verify$;
SELECT public.generate_reminders();
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.notifications)<>4 THEN
  RAISE EXCEPTION 'Second reminder generation duplicated synthetic reminders'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
     AND tablename='notifications' AND policyname='update notif')<>1 THEN
  RAISE EXCEPTION 'Original notification update policy missing'; END IF;
END $verify$;
ROLLBACK;
DO $verify$
BEGIN
 IF to_regclass('public.notifications') IS NOT NULL OR
    to_regclass('cron.synthetic_jobs') IS NOT NULL THEN
  RAISE EXCEPTION 'Original reminder synthetic fixture survived rollback'; END IF;
END $verify$;
SELECT 'PASS: original reminders SQL, four synthetic types, duplicate suppression, inert cron capture, rollback' AS result;
