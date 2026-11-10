-- Synthetic-only integration mapping backfill; no real credentials or external services.
BEGIN;
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE TYPE public.app_role AS ENUM ('admin','viewer');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
CREATE FUNCTION public.has_role(u uuid,r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT r='admin'::public.app_role$$;
CREATE TABLE public.google_integrations(
 id uuid PRIMARY KEY,
 user_id uuid,
 column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz DEFAULT now()
);
INSERT INTO public.google_integrations(id,user_id,column_mapping) VALUES
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','{"candidate":"synthetic"}'::jsonb);
\ir ../../supabase/migrations/20260513123320_d90ef98e-0058-4f43-ac42-0f6df8815fb6.sql
DO $$
BEGIN
 IF (SELECT mapping FROM public.google_integrations LIMIT 1)<>'{"candidate":"synthetic"}'::jsonb
 THEN RAISE EXCEPTION 'Mapping backfill incorrect'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='google_integrations')<>3
 THEN RAISE EXCEPTION 'Own-integration policy count differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='google_integrations_user_id_key')
 THEN RAISE EXCEPTION 'Unique user constraint missing'; END IF;
END $$;
UPDATE public.google_integrations SET column_mapping='{"candidate":"changed"}'::jsonb;
DO $$
BEGIN
 IF (SELECT mapping FROM public.google_integrations LIMIT 1)<>'{"candidate":"changed"}'::jsonb
 THEN RAISE EXCEPTION 'Mapping synchronization trigger failed'; END IF;
END $$;
\ir ../../supabase/migrations/20260513123320_d90ef98e-0058-4f43-ac42-0f6df8815fb6.sql
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.google_integrations'::regclass
 AND tgname='sync_google_integration_mapping_trigger' AND NOT tgisinternal)<>1
 THEN RAISE EXCEPTION 'Mapping trigger duplicate after repeat'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.google_integrations') IS NOT NULL
 THEN RAISE EXCEPTION 'Synthetic integration mapping fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: original integration mapping SQL twice with synthetic backfill and rollback' AS result;
