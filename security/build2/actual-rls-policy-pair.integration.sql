-- Two original RLS policy migrations on synthetic tables; no actual user records.
BEGIN;
CREATE SCHEMA auth;
CREATE TYPE public.app_role AS ENUM ('admin','viewer');
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
CREATE FUNCTION public.has_role(u uuid,r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT r='admin'::public.app_role$$;
CREATE TABLE public.notifications(user_id uuid);
CREATE TABLE public.user_roles(user_id uuid);
CREATE TABLE public.audit_logs(id integer);
CREATE TABLE public.candidate_activities(id integer);
CREATE TABLE public.sync_logs(id integer);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
\ir ../../supabase/migrations/20260517055116_3d1873db-f213-4a74-ae5e-7ea60e86a001.sql
\ir ../../supabase/migrations/20260517055343_d3ca28ec-df58-4b32-ba79-cdc2aedc2157.sql
\ir ../../supabase/migrations/20260517055116_3d1873db-f213-4a74-ae5e-7ea60e86a001.sql
\ir ../../supabase/migrations/20260517055343_d3ca28ec-df58-4b32-ba79-cdc2aedc2157.sql
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname IN
 ('insert notif','self read role','insert audit','admin insert sync logs','read audit','read notif'))<>6
 THEN RAISE EXCEPTION 'Policy count differs after original repeated replay'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='candidate_activities' AND policyname='insert activities')
 THEN RAISE EXCEPTION 'Permissive activity insert policy remains'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications'
 AND policyname='read notif' AND cmd='SELECT' AND roles @> ARRAY['authenticated']::name[])
 THEN RAISE EXCEPTION 'Notification read policy not scoped'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.notifications') IS NOT NULL OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL
 THEN RAISE EXCEPTION 'RLS synthetic fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: two original RLS migrations replayed twice in disposable fixture and rolled back' AS result;
