-- Build 41: synthetic, disposable PostgreSQL 17. Not a live CRM migration.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator LOGIN PASSWORD 'b41_synthetic_postgrest_login_only';
GRANT anon,authenticated TO authenticator;
GRANT USAGE ON SCHEMA public TO anon,authenticated,authenticator;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
SELECT coalesce(
 nullif(current_setting('request.jwt.claim.sub',true),'')::uuid,
 nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub','')::uuid
);
$fn$;
GRANT USAGE ON SCHEMA auth TO authenticated,authenticator;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected');
CREATE TYPE public.candidate_stage AS ENUM('lead_received','screening','interview','offer');
CREATE TABLE public.audit_logs(id uuid,user_id uuid,user_email text,action text,table_name text,record_id text,details jsonb,created_at timestamptz);
CREATE TABLE public.billing(id uuid,invoice_number text,candidate_id uuid,client_id uuid,salary numeric,placement_fee numeric,gst numeric,invoice_amount numeric,payment_status text,outstanding_amount numeric,invoice_date date,created_by uuid,created_at timestamptz,updated_at timestamptz,candidate_uuid uuid,client_uuid uuid,offer_uuid uuid);
CREATE TABLE public.candidate_activities(id uuid,candidate_id uuid,candidate_name text,recruiter_id uuid,recruiter_name text,action_type text,module_created text,related_record_id uuid,notes text,created_at timestamptz);
CREATE TABLE public.candidates(id uuid,candidate_code text,full_name text,mobile text,email text,location text,position_applied text,current_company text,experience_years numeric,current_salary numeric,expected_salary numeric,notice_period text,resume_url text,source text,assigned_recruiter uuid,stage public.candidate_stage,notes text,created_by uuid,created_at timestamptz,updated_at timestamptz,status text,created_source text,resume_summary text,ats_score int4,ats_issues jsonb,ats_checked_at timestamptz);
CREATE TABLE public.clients(id uuid,company_name text,contact_person text,phone text,email text,active_positions int4,agreement_type text,billing_model text,status text,created_by uuid,created_at timestamptz,updated_at timestamptz);
CREATE TABLE public.google_integrations(id uuid,sheet_url text,spreadsheet_id text,sheet_name text,header_row int4,auto_sync_enabled bool,sync_frequency_minutes int4,last_sync timestamptz,last_synced_row int4,google_account_email text,connection_status text,column_mapping jsonb,last_error text,created_at timestamptz,updated_at timestamptz,user_id uuid,mapping jsonb);
CREATE TABLE public.integrations(id uuid,module text,sheet_url text,spreadsheet_id text,sheet_name text,header_row int4,column_mapping jsonb,auto_sync bool,last_sync_at timestamptz,last_synced_row int4,last_status text,last_error text,created_at timestamptz,updated_at timestamptz);
CREATE TABLE public.interviews(id uuid,candidate_id uuid,client_id uuid,round text,interview_date date,interview_time time,mode text,feedback text,status text,created_by uuid,created_at timestamptz,candidate_uuid uuid,client_uuid uuid,submission_uuid uuid,scheduling_token uuid,proposed_slots jsonb);
CREATE TABLE public.job_openings(id uuid,job_title text,client_id uuid,location text,salary_min numeric,salary_max numeric,assigned_recruiter uuid,open_positions int4,priority text,status text,created_by uuid,created_at timestamptz,updated_at timestamptz,client_uuid uuid,requirements text,description text,is_confidential bool);
CREATE TABLE public.notifications(id uuid,user_id uuid,title text,message text,type text,is_read bool,created_at timestamptz,related_table text,related_id uuid);
CREATE TABLE public.offers(id uuid,candidate_id uuid,client_id uuid,offer_date date,joining_date date,salary numeric,ctc numeric,offer_status text,joining_status text,created_by uuid,created_at timestamptz,updated_at timestamptz,candidate_uuid uuid,client_uuid uuid,submission_uuid uuid,interview_uuid uuid);
CREATE TABLE public.profiles(id uuid,full_name text,email text,phone text,department text,role_request text,status public.user_status,is_active bool,created_at timestamptz,updated_at timestamptz);
CREATE TABLE public.submissions(id uuid,candidate_id uuid,client_id uuid,job_id uuid,role_title text,submission_date date,status text,remarks text,created_by uuid,created_at timestamptz,candidate_uuid uuid,client_uuid uuid,job_uuid uuid);
CREATE TABLE public.sync_logs(id uuid,module text,triggered_by text,rows_scanned int4,rows_created int4,rows_updated int4,rows_skipped int4,errors jsonb,status text,message text,created_at timestamptz);
CREATE TABLE public.user_roles(id uuid,user_id uuid,role public.app_role,created_at timestamptz);
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE FUNCTION public.is_approved(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id AND status='approved' AND is_active=true) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role),public.is_approved(uuid) TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
INSERT INTO public.profiles(id,status,is_active) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','approved',true),('11111111-1111-4111-8111-111111111111','approved',true),('22222222-2222-4222-8222-222222222222','approved',true),('33333333-3333-4333-8333-333333333333','approved',true),('44444444-4444-4444-8444-444444444444','approved',true),('55555555-5555-4555-8555-555555555555','pending',true),('66666666-6666-4666-8666-666666666666','approved',false),('77777777-7777-4777-8777-777777777777','approved',true);
INSERT INTO public.user_roles(user_id,role) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),('11111111-1111-4111-8111-111111111111','recruiter'),('22222222-2222-4222-8222-222222222222','recruiter'),('33333333-3333-4333-8333-333333333333','finance'),('44444444-4444-4444-8444-444444444444','operations'),('55555555-5555-4555-8555-555555555555','recruiter'),('66666666-6666-4666-8666-666666666666','recruiter'),('77777777-7777-4777-8777-777777777777','viewer');
INSERT INTO public.candidates(id,assigned_recruiter,full_name) VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','synthetic A'),('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','synthetic B');
INSERT INTO public.job_openings(id,assigned_recruiter) VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222');
INSERT INTO public.notifications(id,user_id,is_read) VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',false),('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222',false);
INSERT INTO public.submissions(id,candidate_uuid) VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222');
INSERT INTO public.interviews(id,candidate_uuid) VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222');
INSERT INTO public.google_integrations(id,user_id) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.billing(id) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.clients(id) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.offers(id) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.integrations(id) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.candidate_activities(id) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.audit_logs(id) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
INSERT INTO public.sync_logs(id) VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- REVIEW-ONLY: comprehensive replacement draft for the 15 exposed CRM tables.
-- NOT a migration, NOT tested in PostgreSQL, DO NOT RUN ON PRODUCTION.
-- Requires local PostgreSQL integration tests and a verified backup/rollback.
-- Assumes auth.uid() and existing public.has_role/is_approved helpers.
-- Every statement is scoped to the fifteen verified tables.
-- IMPORTANT: existing PERMISSIVE policies are OR-combined. Replace ALL policies
-- for these tables, not just the universal ALL=true policies.
DO $$
DECLARE p record;
BEGIN
 FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies
 WHERE schemaname='public' AND tablename=ANY(ARRAY[
 'audit_logs','billing','candidate_activities','candidates','clients',
 'google_integrations','integrations','interviews','job_openings',
 'notifications','offers','profiles','submissions','sync_logs','user_roles'])
 LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
 END LOOP;
END $$;
-- Approved AND active status must be checked in addition to role.
-- No self-approval or self role management: profile changes admin only.
CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated
 USING (id=auth.uid() OR (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin')));
CREATE POLICY profile_admin_update ON public.profiles FOR UPDATE TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY profile_admin_delete ON public.profiles FOR DELETE TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated
 USING (user_id=auth.uid() OR (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin')));
CREATE POLICY roles_admin_write ON public.user_roles FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- Deny all anonymous API privileges on the private tables.
REVOKE ALL ON public.audit_logs,public.billing,public.candidate_activities,
 public.candidates,public.clients,public.google_integrations,public.integrations,
 public.interviews,public.job_openings,public.notifications,public.offers,
 public.profiles,public.submissions,public.sync_logs,public.user_roles FROM anon;
-- Protect role/profile writes from accidental broad table grants.
-- Role changes are intended to use a reviewed privileged administrative workflow.
REVOKE INSERT,UPDATE,DELETE ON public.user_roles FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.profiles FROM authenticated;
-- Admin profile approval / role management workflows must be migrated to a
-- reviewed server-side privileged RPC BEFORE enabling this migration.
-- These revocations intentionally fail closed; current UI admin flows may break.
-- Column privileges and audited server-side workflows are prerequisites:
-- RLS cannot stop a recruiter changing assigned_recruiter while still
-- satisfying WITH CHECK on the new row. Existing UPDATE table grants must
-- be narrowed to explicitly permitted non-ownership columns.
-- Likewise notification UPDATE needs a narrowly granted is_read-only path.
-- These controls are not implemented here. This SQL MUST remain inactive.
-- IMPORTANT: broad table-level UPDATE grants and policy OR-composition can
-- permit owner/recipient reassignment. No release until a verified
-- column-grant strategy and trigger-level immutable ownership check exists.
-- Verify has_role/is_approved SECURITY DEFINER search_path and EXECUTE grants.
-- The draft currently deliberately denies recruiter submission/interview
-- writes and admin UI profile/role writes: these are release blockers.
-- No Operations AI access is granted by these table policies.
CREATE POLICY candidates_read ON public.candidates FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY candidates_insert ON public.candidates FOR INSERT TO authenticated
 WITH CHECK (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY candidates_update ON public.candidates FOR UPDATE TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())))
 WITH CHECK (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY candidates_delete ON public.candidates FOR DELETE TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- Job ownership is assigned_recruiter, not arbitrary created_by.
CREATE POLICY jobs_read ON public.job_openings FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY jobs_insert ON public.job_openings FOR INSERT TO authenticated
 WITH CHECK (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY jobs_update ON public.job_openings FOR UPDATE TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())))
 WITH CHECK (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND assigned_recruiter=auth.uid())));
CREATE POLICY jobs_delete ON public.job_openings FOR DELETE TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- Relationship-based access: no cross-recruiter submission/interview/offer access.
CREATE POLICY submissions_read ON public.submissions FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND EXISTS
 (SELECT 1 FROM public.candidates c WHERE c.id=coalesce(candidate_uuid,candidate_id) AND c.assigned_recruiter=auth.uid()))));
CREATE POLICY submissions_write ON public.submissions FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY interviews_read ON public.interviews FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND EXISTS
 (SELECT 1 FROM public.candidates c WHERE c.id=coalesce(candidate_uuid,candidate_id) AND c.assigned_recruiter=auth.uid()))));
CREATE POLICY interviews_write ON public.interviews FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY offers_read ON public.offers FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY offers_write ON public.offers FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- Financial, integration, audit and sync data are privileged, not generic approved-user.
CREATE POLICY billing_admin_read ON public.billing FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance')));
CREATE POLICY billing_admin_write ON public.billing FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY clients_admin_read ON public.clients FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY clients_admin_write ON public.clients FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY activities_read ON public.candidate_activities FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY sync_read ON public.sync_logs FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY integrations_admin ON public.integrations FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY google_integrations_admin ON public.google_integrations FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin') AND user_id=auth.uid())
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin') AND user_id=auth.uid());
-- Notifications: recipient can read and mark own rows; no user-created global messages.
CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND (user_id=auth.uid() OR
 public.has_role(auth.uid(),'admin')));
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
 USING (public.is_approved(auth.uid()) AND user_id=auth.uid())
 WITH CHECK (public.is_approved(auth.uid()) AND user_id=auth.uid());
CREATE POLICY notifications_admin_insert ON public.notifications FOR INSERT TO authenticated
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));

-- Signature and expected permissions are taken from the exact Build38 RLS source.
SELECT 'PASS: Build41 production-shaped 15-table RLS schema initialized' AS outcome;
