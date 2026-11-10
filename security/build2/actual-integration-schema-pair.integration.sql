-- Two original integration schema migrations on disposable synthetic tables.
BEGIN;
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE TYPE public.app_role AS ENUM ('admin','viewer');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
CREATE FUNCTION public.has_role(u uuid,r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT r='admin'::public.app_role$$;
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TABLE public.candidates(id uuid PRIMARY KEY,email text,mobile text);
\ir ../../supabase/migrations/20260513101524_83dbcbcf-1eb1-4042-9ec1-3b53fcba7372.sql
\ir ../../supabase/migrations/20260513113833_08d7691f-5369-48f1-8027-8c46de7b49ae.sql
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
 AND tablename IN ('integrations','sync_logs','google_integrations'))<>6
 THEN RAISE EXCEPTION 'Integration policy count differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.google_integrations'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.integrations'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Integration RLS disabled'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgname IN
 ('integrations_updated_at','set_google_integrations_updated_at') AND NOT tgisinternal)<>2
 THEN RAISE EXCEPTION 'Update triggers missing'; END IF;
END $$;
INSERT INTO public.google_integrations(spreadsheet_id) VALUES('synthetic-sheet');
DO $$
BEGIN
 IF (SELECT count(*) FROM public.integrations WHERE module='candidates')<>1
 THEN RAISE EXCEPTION 'Original seed integration missing'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.integrations') IS NOT NULL OR to_regclass('public.google_integrations') IS NOT NULL
 THEN RAISE EXCEPTION 'Synthetic integration fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: two original integration schema migrations tested with synthetic rollback' AS result;
