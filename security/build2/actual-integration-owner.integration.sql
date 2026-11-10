-- Original integration owner backfill against synthetic records only. No real profiles.
BEGIN;
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE TYPE public.app_role AS ENUM ('admin','viewer');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
CREATE FUNCTION public.has_role(u uuid,r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT u='00000000-0000-0000-0000-000000000001'::uuid AND r='admin'::public.app_role
$$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,email text,created_at timestamptz NOT NULL);
CREATE TABLE public.google_integrations(id uuid PRIMARY KEY,spreadsheet_id text);
INSERT INTO public.profiles VALUES('00000000-0000-0000-0000-000000000001','synthetic@example.invalid',now());
INSERT INTO public.google_integrations VALUES('00000000-0000-0000-0000-000000000002','synthetic-sheet');
\ir ../../supabase/migrations/20260513120653_866325d2-3efd-4d67-be04-266cfec6243d.sql
DO $$
BEGIN
 IF (SELECT user_id FROM public.google_integrations LIMIT 1)<>'00000000-0000-0000-0000-000000000001'::uuid
 THEN RAISE EXCEPTION 'Synthetic owner backfill failed'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='google_integrations')<>3
 THEN RAISE EXCEPTION 'Owner policy count mismatch'; END IF;
END $$;
\ir ../../supabase/migrations/20260513120653_866325d2-3efd-4d67-be04-266cfec6243d.sql
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.google_integrations') IS NOT NULL OR to_regclass('public.profiles') IS NOT NULL
 THEN RAISE EXCEPTION 'Owner fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: original owner backfill twice with synthetic-only profile and rollback' AS result;
