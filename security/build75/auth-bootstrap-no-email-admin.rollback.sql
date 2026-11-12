-- Build75: NONDEPLOYABLE lab-only candidate for removing email-based admin bootstrap.
-- Secure role granting must be separately approved by an authorized human workflow;
-- this proposal never promotes a registration email or user-supplied metadata to admin.
-- Never run in a hosted project; exact disposable-database name guard enforced first.
BEGIN;
SET LOCAL statement_timeout='45s';
DO $b75_hardening_guard$
BEGIN
 IF current_database()<>'amf_build75_auth_lab' THEN
  RAISE EXCEPTION 'Build75 auth hardening refuses non-disposable database';
 END IF;
END $b75_hardening_guard$;
CREATE SCHEMA auth;
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected','suspended');
CREATE TABLE public.profiles("id" uuid,"full_name" text,"email" text,"phone" text,"department" text,"role_request" text,"status" public.user_status,"is_active" bool,"created_at" timestamptz,"updated_at" timestamptz);
CREATE TABLE public.user_roles("id" uuid,"user_id" uuid,"role" public.app_role,"created_at" timestamptz);
ALTER TABLE public.profiles ADD CONSTRAINT b75_profiles_pk PRIMARY KEY(id);
ALTER TABLE public.user_roles ADD CONSTRAINT b75_user_roles_uid_uq UNIQUE(user_id);
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text NOT NULL,raw_user_meta_data jsonb);
CREATE ROLE b75_new_registration_actor NOLOGIN;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 AS $b75_safe_onboarding$
BEGIN
 IF NEW.id IS NULL OR NEW.email IS NULL THEN
  RAISE EXCEPTION 'New Auth user lacks required synthetic identity fields';
 END IF;
 INSERT INTO public.profiles
   (id,full_name,email,phone,department,role_request,status,is_active)
 VALUES
   (NEW.id,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'),''),split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'role_request',
    'pending'::public.user_status,
    false)
 ON CONFLICT (id) DO NOTHING;
 INSERT INTO public.user_roles(user_id,role)
 VALUES (NEW.id,'viewer'::public.app_role)
 ON CONFLICT (user_id) DO NOTHING;
 RETURN NEW;
END;
$b75_safe_onboarding$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC,b75_new_registration_actor;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Reject any direct grant or anonymous invocation while retaining normal trigger execution.
DO $b75_permissions$
BEGIN
 IF has_function_privilege('b75_new_registration_actor','public.handle_new_user()','EXECUTE') THEN
  RAISE EXCEPTION 'Auth bootstrap remains directly callable by a non-owner';
 END IF;
END $b75_permissions$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('a7500000-0000-4000-8000-000000000001','invented-person-1@example.invalid',
 '{"full_name":"Invented Person A","role":"admin","role_request":"admin","is_admin":true}'::jsonb),
('a7500000-0000-4000-8000-000000000002','invented-person-2@example.invalid',
 '{"full_name":"Invented Person B","role_request":"finance"}'::jsonb);
DO $b75_no_implicit_privilege$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.profiles p
 JOIN public.user_roles r ON r.user_id=p.id
 WHERE p.email LIKE '%@example.invalid' AND p.status='pending'::public.user_status
   AND p.is_active=false AND r.role='viewer'::public.app_role;
 IF n<>2 THEN RAISE EXCEPTION 'Registration metadata escalated privileges or failed safe onboarding'; END IF;
 SELECT count(*) INTO n FROM public.user_roles WHERE role='admin'::public.app_role;
 IF n<>0 THEN RAISE EXCEPTION 'Registration created an unauthorized admin'; END IF;
 SELECT count(*) INTO n FROM public.profiles WHERE status='approved'::public.user_status OR is_active;
 IF n<>0 THEN RAISE EXCEPTION 'New synthetic registration is incorrectly approved or active'; END IF;
END $b75_no_implicit_privilege$;
ROLLBACK;
