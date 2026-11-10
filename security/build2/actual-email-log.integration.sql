-- Synthetic-only email history schema, never calls email providers.
BEGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE ROLE authenticated NOLOGIN;
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','viewer');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
CREATE FUNCTION public.is_approved(u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT true$$;
CREATE FUNCTION public.has_role(u uuid,r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT r='admin'::public.app_role$$;
\ir ../../supabase/migrations/20260929070000_email_log.sql
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='email_log' AND c.relrowsecurity)
 THEN RAISE EXCEPTION 'Email log RLS missing'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='email_log')<>2
 THEN RAISE EXCEPTION 'Email log policy count mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='email_log'
 AND indexname='email_log_related_idx')
 THEN RAISE EXCEPTION 'Email log index missing'; END IF;
END $$;
INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000000001');
INSERT INTO public.email_log(id,related_table,related_id,to_email,subject,body,sent_by)
VALUES('00000000-0000-0000-0000-000000000002','candidates','00000000-0000-0000-0000-000000000003',
'synthetic@example.invalid','Synthetic','Synthetic body','00000000-0000-0000-0000-000000000001');
DO $$
BEGIN
 IF (SELECT status FROM public.email_log LIMIT 1)<>'sent'
 THEN RAISE EXCEPTION 'Default status missing'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.email_log') IS NOT NULL
 THEN RAISE EXCEPTION 'Email log fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: original email log migration on synthetic fixture with rollback' AS result;
