-- Original branding migration; synthetic auth and storage schemas only, rollback enforced.
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false);
CREATE TABLE storage.objects(id integer PRIMARY KEY,bucket_id text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT r='admin'$$;
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
\ir ../../supabase/migrations/20260927120000_app_settings_branding.sql
DO $$
BEGIN
 IF (SELECT count(*) FROM public.app_settings)<>1
 THEN RAISE EXCEPTION 'Singleton seed missing'; END IF;
 IF (SELECT count(*) FROM storage.buckets WHERE id='branding' AND public)<>1
 THEN RAISE EXCEPTION 'Synthetic branding bucket missing'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects')<>4
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='app_settings')<>2
 THEN RAISE EXCEPTION 'Branding policy count differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.app_settings'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'App settings RLS missing'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.app_settings') IS NOT NULL OR to_regclass('storage.buckets') IS NOT NULL
 THEN RAISE EXCEPTION 'Branding fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: original branding migration tested on synthetic storage and auth schemas' AS result;
