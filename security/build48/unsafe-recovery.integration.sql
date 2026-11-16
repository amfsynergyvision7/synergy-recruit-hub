-- Build48 exact read-only production RLS policy replay and migration application.
-- This is a disposable PostgreSQL 17 test that creates synthetic rows and rolls back.
-- Build47: source-derived 19 table/13 view schema, 16 actual function signatures, 15 unsafe policies.
-- Everything is synthetic in an isolated transaction and ROLLED BACK.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
SET LOCAL statement_timeout='45s';
SET LOCAL search_path=public,pg_catalog;
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected','suspended');
CREATE TYPE public.candidate_stage AS ENUM('lead_received','contacted','interested','resume_collected','submitted_to_client','interview_scheduled','interview_completed','selected','offer_released','joined','rejected','dropped');
CREATE TABLE public.app_settings("id" int4,"logo_url" text,"updated_by" uuid,"updated_at" timestamptz,"resume_import_folder_url" text,"default_color_theme" text);
CREATE TABLE public.audit_logs("id" uuid,"user_id" uuid,"user_email" text,"action" text,"table_name" text,"record_id" text,"details" jsonb,"created_at" timestamptz);
CREATE TABLE public.billing("id" uuid,"invoice_number" text,"candidate_id" uuid,"client_id" uuid,"salary" numeric,"placement_fee" numeric,"gst" numeric,"invoice_amount" numeric,"payment_status" text,"outstanding_amount" numeric,"invoice_date" date,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz,"candidate_uuid" uuid,"client_uuid" uuid,"offer_uuid" uuid);
CREATE TABLE public.candidate_activities("id" uuid,"candidate_id" uuid,"candidate_name" text,"recruiter_id" uuid,"recruiter_name" text,"action_type" text,"module_created" text,"related_record_id" uuid,"notes" text,"created_at" timestamptz);
CREATE TABLE public.candidate_stage_history("id" uuid,"candidate_id" uuid,"previous_stage" text,"new_stage" text,"changed_by" uuid,"notes" text,"created_at" timestamptz);
CREATE TABLE public.candidates("id" uuid,"candidate_code" text,"full_name" text,"mobile" text,"email" text,"location" text,"position_applied" text,"current_company" text,"experience_years" numeric,"current_salary" numeric,"expected_salary" numeric,"notice_period" text,"resume_url" text,"source" text,"assigned_recruiter" uuid,"stage" public.candidate_stage,"notes" text,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz,"status" text,"created_source" text,"resume_summary" text,"ats_score" int4,"ats_issues" jsonb,"ats_checked_at" timestamptz);
CREATE TABLE public.clients("id" uuid,"company_name" text,"contact_person" text,"phone" text,"email" text,"active_positions" int4,"agreement_type" text,"billing_model" text,"status" text,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz);
CREATE TABLE public.email_log("id" uuid,"related_table" text,"related_id" uuid,"to_email" text,"subject" text,"body" text,"status" text,"error" text,"provider_id" text,"sent_by" uuid,"created_at" timestamptz);
CREATE TABLE public.google_integrations("id" uuid,"sheet_url" text,"spreadsheet_id" text,"sheet_name" text,"header_row" int4,"auto_sync_enabled" bool,"sync_frequency_minutes" int4,"last_sync" timestamptz,"last_synced_row" int4,"google_account_email" text,"connection_status" text,"column_mapping" jsonb,"last_error" text,"created_at" timestamptz,"updated_at" timestamptz,"user_id" uuid,"mapping" jsonb);
CREATE TABLE public.integrations("id" uuid,"module" text,"sheet_url" text,"spreadsheet_id" text,"sheet_name" text,"header_row" int4,"column_mapping" jsonb,"auto_sync" bool,"last_sync_at" timestamptz,"last_synced_row" int4,"last_status" text,"last_error" text,"created_at" timestamptz,"updated_at" timestamptz);
CREATE TABLE public.interviews("id" uuid,"candidate_id" uuid,"client_id" uuid,"round" text,"interview_date" date,"interview_time" time,"mode" text,"feedback" text,"status" text,"created_by" uuid,"created_at" timestamptz,"candidate_uuid" uuid,"client_uuid" uuid,"submission_uuid" uuid,"scheduling_token" uuid,"proposed_slots" jsonb);
CREATE TABLE public.job_openings("id" uuid,"job_title" text,"client_id" uuid,"location" text,"salary_min" numeric,"salary_max" numeric,"assigned_recruiter" uuid,"open_positions" int4,"priority" text,"status" text,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz,"client_uuid" uuid,"requirements" text,"description" text,"is_confidential" bool);
CREATE TABLE public.notifications("id" uuid,"user_id" uuid,"title" text,"message" text,"type" text,"is_read" bool,"created_at" timestamptz,"related_table" text,"related_id" uuid);
CREATE TABLE public.offers("id" uuid,"candidate_id" uuid,"client_id" uuid,"offer_date" date,"joining_date" date,"salary" numeric,"ctc" numeric,"offer_status" text,"joining_status" text,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz,"candidate_uuid" uuid,"client_uuid" uuid,"submission_uuid" uuid,"interview_uuid" uuid);
CREATE TABLE public.profiles("id" uuid,"full_name" text,"email" text,"phone" text,"department" text,"role_request" text,"status" public.user_status,"is_active" bool,"created_at" timestamptz,"updated_at" timestamptz);
CREATE TABLE public.submissions("id" uuid,"candidate_id" uuid,"client_id" uuid,"job_id" uuid,"role_title" text,"submission_date" date,"status" text,"remarks" text,"created_by" uuid,"created_at" timestamptz,"candidate_uuid" uuid,"client_uuid" uuid,"job_uuid" uuid);
CREATE TABLE public.sync_logs("id" uuid,"module" text,"triggered_by" text,"rows_scanned" int4,"rows_created" int4,"rows_updated" int4,"rows_skipped" int4,"errors" jsonb,"status" text,"message" text,"created_at" timestamptz);
CREATE TABLE public.user_roles("id" uuid,"user_id" uuid,"role" public.app_role,"created_at" timestamptz);
CREATE TABLE public.workflow_rules("id" uuid,"name" text,"table_name" text,"field_name" text,"field_value" text,"action_type" text,"notify_target" text,"notify_title" text,"notify_message" text,"update_field_name" text,"update_field_value" text,"is_active" bool,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz);
CREATE VIEW public.available_recruiters AS SELECT id,
    full_name,
    email,
    'Available'::text AS status
   FROM profiles
  WHERE status = 'approved'::user_status
  ORDER BY full_name;
CREATE VIEW public.candidates_for_assignment AS SELECT id,
    candidate_code,
    full_name,
    position_applied,
    stage,
    created_at,
    assigned_recruiter,
        CASE
            WHEN assigned_recruiter IS NULL THEN 'NOT ASSIGNED'::text
            ELSE 'ASSIGNED'::text
        END AS assignment_status
   FROM candidates
  ORDER BY assigned_recruiter NULLS FIRST, created_at DESC;
CREATE VIEW public.recruiter_performance AS SELECT p.id AS recruiter_id,
    p.full_name AS recruiter_name,
    p.email AS recruiter_email,
    count(c.id) AS total_candidates,
    count(
        CASE
            WHEN c.stage = 'lead_received'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS lead_received,
    count(
        CASE
            WHEN c.stage = 'contacted'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS contacted,
    count(
        CASE
            WHEN c.stage = 'interested'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS interested,
    count(
        CASE
            WHEN c.stage = 'resume_collected'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS resume_collected,
    count(
        CASE
            WHEN c.stage = 'submitted_to_client'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS submitted_to_client,
    count(
        CASE
            WHEN c.stage = 'interview_scheduled'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS interview_scheduled,
    count(
        CASE
            WHEN c.stage = 'interview_completed'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS interview_completed,
    count(
        CASE
            WHEN c.stage = 'selected'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS selected,
    count(
        CASE
            WHEN c.stage = 'offer_released'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS offer_released,
    count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS joined,
    count(
        CASE
            WHEN c.stage = 'rejected'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS rejected,
    count(
        CASE
            WHEN c.stage = 'dropped'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS dropped,
    count(
        CASE
            WHEN c.created_at > (now() - '30 days'::interval) THEN 1
            ELSE NULL::integer
        END) AS last_30_days,
    round(count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END)::numeric / NULLIF(count(
        CASE
            WHEN c.stage = 'selected'::candidate_stage THEN 1
            ELSE NULL::integer
        END), 0)::numeric * 100::numeric, 2) AS conversion_to_join_rate
   FROM profiles p
     LEFT JOIN candidates c ON c.assigned_recruiter = p.id
  WHERE p.status = 'approved'::user_status
  GROUP BY p.id, p.full_name, p.email
  ORDER BY (count(c.id)) DESC;
CREATE VIEW public.recruiter_performance_with_names AS SELECT p.full_name AS recruiter_name,
    p.id AS recruiter_id,
    count(c.id) AS total_candidates,
    count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS placements,
    count(
        CASE
            WHEN c.stage = 'lead_received'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS new_leads,
    count(
        CASE
            WHEN c.stage = ANY (ARRAY['interview_scheduled'::candidate_stage, 'interview_completed'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS interviewing,
    count(
        CASE
            WHEN c.stage = ANY (ARRAY['rejected'::candidate_stage, 'dropped'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS lost,
    round(count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END)::numeric / NULLIF(count(c.id), 0)::numeric * 100::numeric, 2) AS placement_rate
   FROM profiles p
     LEFT JOIN candidates c ON c.assigned_recruiter = p.id
  WHERE p.status = 'approved'::user_status
  GROUP BY p.id, p.full_name
  ORDER BY (count(c.id)) DESC;
CREATE VIEW public.recruiter_stats AS SELECT p.id,
    p.full_name,
    count(c.id) AS total,
    count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS placed,
    count(
        CASE
            WHEN c.stage = 'lead_received'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS new_leads,
    count(
        CASE
            WHEN c.stage = ANY (ARRAY['interview_scheduled'::candidate_stage, 'interview_completed'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS interviewing,
    round(count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END)::numeric / NULLIF(count(c.id), 0)::numeric * 100::numeric, 2) AS conversion_rate
   FROM profiles p
     LEFT JOIN candidates c ON c.assigned_recruiter = p.id
  WHERE p.status = 'approved'::user_status
  GROUP BY p.id, p.full_name
  ORDER BY (count(c.id)) DESC;
CREATE VIEW public.recruiter_summary AS SELECT p.full_name AS recruiter,
    count(c.id) AS total_candidates,
    count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS hires,
    count(
        CASE
            WHEN c.stage = ANY (ARRAY['rejected'::candidate_stage, 'dropped'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS lost,
    count(
        CASE
            WHEN c.stage <> ALL (ARRAY['joined'::candidate_stage, 'rejected'::candidate_stage, 'dropped'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS active_pipeline
   FROM profiles p
     LEFT JOIN candidates c ON c.assigned_recruiter = p.id
  WHERE p.status = 'approved'::user_status
  GROUP BY p.id, p.full_name
  ORDER BY (count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END)) DESC;
CREATE VIEW public.vw_billing_filters AS SELECT id,
    invoice_number,
    candidate_id,
    client_id,
    salary,
    placement_fee,
    gst,
    invoice_amount,
    payment_status,
    outstanding_amount,
    invoice_date,
    created_by,
    created_at,
    updated_at,
    candidate_uuid,
    client_uuid,
    offer_uuid
   FROM billing;
CREATE VIEW public.vw_candidate_filters AS SELECT id,
    candidate_code,
    full_name,
    location,
    position_applied,
    experience_years,
    status,
    stage,
    assigned_recruiter,
    created_at
   FROM candidates;
CREATE VIEW public.vw_client_filters AS SELECT id,
    company_name,
    contact_person,
    status,
    agreement_type,
    billing_model,
    active_positions,
    created_at
   FROM clients;
CREATE VIEW public.vw_interview_filters AS SELECT id,
    candidate_id,
    client_id,
    round,
    interview_date,
    interview_time,
    mode,
    feedback,
    status,
    created_by,
    created_at,
    candidate_uuid,
    client_uuid,
    submission_uuid
   FROM interviews;
CREATE VIEW public.vw_job_filters AS SELECT id,
    job_title,
    location,
    priority,
    status,
    assigned_recruiter,
    open_positions,
    created_at
   FROM job_openings;
CREATE VIEW public.vw_offer_filters AS SELECT id,
    candidate_id,
    client_id,
    offer_date,
    joining_date,
    salary,
    ctc,
    offer_status,
    joining_status,
    created_by,
    created_at,
    updated_at,
    candidate_uuid,
    client_uuid,
    submission_uuid,
    interview_uuid
   FROM offers;
CREATE VIEW public.vw_submission_filters AS SELECT id,
    candidate_id,
    client_id,
    job_id,
    role_title,
    submission_date,
    status,
    remarks,
    created_by,
    created_at,
    candidate_uuid,
    client_uuid,
    job_uuid
   FROM submissions;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.generate_reminders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN; END $b47$;
CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NULL; END $b47$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NEW; END $b47$;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NULL; END $b47$;
CREATE FUNCTION public.is_approved(_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NULL; END $b47$;
CREATE FUNCTION public.on_candidate_stage_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NEW; END $b47$;
CREATE FUNCTION public.on_interview_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NEW; END $b47$;
CREATE FUNCTION public.on_offer_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NEW; END $b47$;
CREATE FUNCTION public.on_submission_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NEW; END $b47$;
CREATE FUNCTION public.resolve_candidate_uuid(_value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NULL; END $b47$;
CREATE FUNCTION public.resolve_client_uuid(_value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NULL; END $b47$;
CREATE FUNCTION public.resolve_job_uuid(_value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NULL; END $b47$;
CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN NULL; END $b47$;
CREATE FUNCTION public.run_workflow_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NEW; END $b47$;
CREATE FUNCTION public.set_assigned_recruiter() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NEW; END $b47$;
CREATE FUNCTION public.track_stage_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $b47$ BEGIN RETURN NEW; END $b47$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC,anon,authenticated;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $b48_auth$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$b48_auth$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $approval$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=_user_id AND p.status='approved' AND p.is_active IS TRUE)
$approval$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $rolefn$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r
 JOIN public.profiles p ON p.id=r.user_id
 WHERE r.user_id=_user_id AND r.role=_role AND p.status='approved' AND p.is_active IS TRUE)
$rolefn$;
INSERT INTO public.profiles(id,full_name,email,status,is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Synthetic Administrator','admin@example.invalid','approved',true),
 ('11111111-1111-4111-8111-111111111111','Recruiter A','a@example.invalid','approved',true),
 ('22222222-2222-4222-8222-222222222222','Recruiter B','b@example.invalid','approved',true),
 ('33333333-3333-4333-8333-333333333333','Inactive Recruiter','inactive@example.invalid','approved',false);
INSERT INTO public.user_roles(user_id,role) VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),
 ('11111111-1111-4111-8111-111111111111','recruiter'),
 ('22222222-2222-4222-8222-222222222222','recruiter'),
 ('33333333-3333-4333-8333-333333333333','recruiter');
INSERT INTO public.candidates(id,full_name,assigned_recruiter) VALUES
 ('11111111-1111-4111-8111-111111111111','Candidate A','11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222','Candidate B','22222222-2222-4222-8222-222222222222');
INSERT INTO public.billing(id,invoice_number) VALUES
 ('44444444-4444-4444-8444-444444444444','SYNTHETIC-ONLY');



-- BUILD48 READ-ONLY LIVE 67-POLICY DEFINITION SNAPSHOT (2026-11-11).
-- REPRODUCE IN SYNTHETIC CI DATABASE ONLY. NOT an active migration.
CREATE POLICY "admin update app settings" ON public."app_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "public read app settings" ON public."app_settings" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Allow all for authenticated" ON public."audit_logs" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "insert audit" ON public."audit_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "read audit" ON public."audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow all for authenticated" ON public."billing" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete bill" ON public."billing" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert bill" ON public."billing" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)));
CREATE POLICY "read bill" ON public."billing" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update bill" ON public."billing" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."candidate_activities" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "read activities" ON public."candidate_activities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "Allow all for authenticated" ON public."candidates" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete candidates" ON public."candidates" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert candidates" ON public."candidates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read candidates" ON public."candidates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update candidates" ON public."candidates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role) OR has_role(auth.uid(), 'operations'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."clients" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete clients" ON public."clients" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert clients" ON public."clients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read clients" ON public."clients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update clients" ON public."clients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "insert email_log" ON public."email_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read email_log" ON public."email_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "Allow all for authenticated" ON public."google_integrations" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin insert own google integration" ON public."google_integrations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "admin select own google integration" ON public."google_integrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "admin update own google integration" ON public."google_integrations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."integrations" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin read integrations" ON public."integrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin write integrations" ON public."integrations" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow all for authenticated" ON public."interviews" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete int" ON public."interviews" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert int" ON public."interviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read int" ON public."interviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update int" ON public."interviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."job_openings" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete jobs" ON public."job_openings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert jobs" ON public."job_openings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read jobs" ON public."job_openings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update jobs" ON public."job_openings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."notifications" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "insert notif" ON public."notifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "read notif" ON public."notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "update notif" ON public."notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = auth.uid()) OR (user_id IS NULL)));
CREATE POLICY "Allow all for authenticated" ON public."offers" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete off" ON public."offers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert off" ON public."offers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role) OR has_role(auth.uid(), 'operations'::app_role)));
CREATE POLICY "read off" ON public."offers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update off" ON public."offers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."profiles" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin delete profiles" ON public."profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update profiles" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "approved read profiles" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_approved(auth.uid()) OR (auth.uid() = id)));
CREATE POLICY "self update profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = id));
CREATE POLICY "Allow all for authenticated" ON public."submissions" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete subs" ON public."submissions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert subs" ON public."submissions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read subs" ON public."submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update subs" ON public."submissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."sync_logs" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin insert sync logs" ON public."sync_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin read sync logs" ON public."sync_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow all for authenticated" ON public."user_roles" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin manage roles" ON public."user_roles" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "self read role" ON public."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "admin manage workflow rules" ON public."workflow_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Counterexample: 52 old permissive policies are not eliminated
-- by dropping the 15 unrestricted ALL policies alone.
SET ROLE authenticated;
DO $b48_leak$ DECLARE n integer; BEGIN
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 SELECT COUNT(*) INTO n FROM public.candidates;
 IF n<>2 THEN RAISE EXCEPTION 'Expected legacy approved recruiter candidate exposure 2, got %',n; END IF;
 SELECT COUNT(*) INTO n FROM public.billing;
 IF n<>1 THEN RAISE EXCEPTION 'Expected legacy broad billing exposure 1, got %',n; END IF;
END $b48_leak$;
RESET ROLE;

SAVEPOINT b48_policy_drift;
ALTER POLICY "read candidates" ON public.candidates USING (true);
DO $b48_digest_negative$ BEGIN
 BEGIN
  EXECUTE $execute_guard$ DO $exact_legacy$
DECLARE count_p integer; digest text;
BEGIN
 SELECT COUNT(*),md5(string_agg(
    tablename||E'\x1f'||policyname||E'\x1f'||permissive||E'\x1f'||
    roles::text||E'\x1f'||cmd||E'\x1f'||coalesce(qual,'<NULL>')||
    E'\x1f'||coalesce(with_check,'<NULL>'),
    E'\n' ORDER BY tablename,policyname
 )) INTO count_p,digest
 FROM pg_policies WHERE schemaname='public';
 IF count_p<>67 OR digest<>'a70190f31ed8436b2989082898a02b51' THEN
   RAISE EXCEPTION 'Build48 exact 67-policy catalog fingerprint changed; release blocked (% / %)',
     count_p,digest USING ERRCODE='P0001';
 END IF;
END $exact_legacy$; $execute_guard$;

  RAISE EXCEPTION 'Exact policy fingerprint accepted a changed legacy candidate rule';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE 'Build48 exact 67-policy catalog fingerprint changed%' THEN RAISE; END IF;
 END;
END $b48_digest_negative$;
ROLLBACK TO SAVEPOINT b48_policy_drift;

DO $exact_legacy$
DECLARE count_p integer; digest text;
BEGIN
 SELECT COUNT(*),md5(string_agg(
    tablename||E'\x1f'||policyname||E'\x1f'||permissive||E'\x1f'||
    roles::text||E'\x1f'||cmd||E'\x1f'||coalesce(qual,'<NULL>')||
    E'\x1f'||coalesce(with_check,'<NULL>'),
    E'\n' ORDER BY tablename,policyname
 )) INTO count_p,digest
 FROM pg_policies WHERE schemaname='public';
 IF count_p<>67 OR digest<>'a70190f31ed8436b2989082898a02b51' THEN
   RAISE EXCEPTION 'Build48 exact 67-policy catalog fingerprint changed; release blocked (% / %)',
     count_p,digest USING ERRCODE='P0001';
 END IF;
END $exact_legacy$;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog,public;

DO $preflight$
DECLARE n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
   RAISE EXCEPTION 'Expected Supabase API roles missing' USING ERRCODE='P0001';
 END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r' AND c.relname=ANY(ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']::text[])
 AND c.relrowsecurity;
 IF n<>19 THEN RAISE EXCEPTION '48-object baseline drift: tables RLS % expected 19',n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='v' AND c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[])
 AND coalesce('security_invoker=true'=ANY(c.reloptions),false)=false
 AND has_table_privilege('anon',c.oid,'SELECT');
 IF n<>13 THEN RAISE EXCEPTION '48-object baseline drift: exposed views % expected 13',n; END IF;
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='public' AND p.proname=ANY(ARRAY['generate_reminders','get_user_role','handle_new_user','has_role','is_approved','on_candidate_stage_change','on_interview_change','on_offer_change','on_submission_insert','resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid','rls_auto_enable','run_workflow_rules','set_assigned_recruiter','track_stage_changes']::text[])
 AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE');
 IF n<>16 THEN RAISE EXCEPTION '48-object baseline drift: privileged functions % expected 16',n; END IF;
 SELECT count(*) INTO n FROM pg_policies
 WHERE schemaname='public' AND tablename=ANY(ARRAY['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles']::text[]) AND policyname='Allow all for authenticated'
 AND cmd='ALL' AND permissive='PERMISSIVE' AND roles::text='{public}'
 AND qual='true' AND with_check='true';
 IF n<>15 THEN RAISE EXCEPTION '48-object baseline drift: broad RLS policies % expected 15',n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r' AND c.relname=ANY(ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']::text[])
 AND has_table_privilege('anon',c.oid,'TRUNCATE');
 IF n<>19 THEN RAISE EXCEPTION '48-object baseline drift: anon TRUNCATE % expected 19',n; END IF;
 -- Additional independently verified column requirements from live app_settings.
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='app_settings' AND column_name='resume_import_folder_url')
 OR NOT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='app_settings' AND column_name='default_color_theme')
 THEN RAISE EXCEPTION 'Branding/private folder field drift'; END IF;
END $preflight$;

-- RLS PERMISSIVE policies are OR-combined, so merely creating restrictive
-- policies would never neutralize these fifteen universal TRUE policies.
DO $broad$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles']::text[]
 LOOP EXECUTE format('DROP POLICY %I ON public.%I','Allow all for authenticated',tab);
 END LOOP;
END $broad$;

-- Anonymous/PUBLIC privileges are unsafe even with RLS: TRUNCATE bypasses RLS.
DO $tables$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']::text[]
 LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon',tab);
  EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.%I FROM authenticated',tab);
 END LOOP;
END $tables$;
-- Only the approved public branding fields remain accessible to anonymous users.
-- This intentionally removes authenticated app_settings table-level reads/writes;
-- compatible admin settings RPCs and browser UAT are mandatory before release.
REVOKE ALL ON TABLE public.app_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,logo_url,default_color_theme) ON TABLE public.app_settings TO anon,authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;

DO $views$
DECLARE v text;
BEGIN
 FOREACH v IN ARRAY ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[]
 LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon',v);
  EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',v);
 END LOOP;
END $views$;

-- SECURITY DEFINER functions must not be exposed through inherited PUBLIC EXECUTE.
-- Preserve only the three existing authenticated RLS helpers; service role is
-- explicitly granted all sixteen for server/trigger compatibility testing.
DO $functions$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature,p.proname
 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='public' AND p.prosecdef AND p.proname=ANY(ARRAY['generate_reminders','get_user_role','handle_new_user','has_role','is_approved','on_candidate_stage_change','on_interview_change','on_offer_change','on_submission_insert','resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid','rls_auto_enable','run_workflow_rules','set_assigned_recruiter','track_stage_changes']::text[])
 LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  IF f.proname=ANY(ARRAY['get_user_role','has_role','is_approved']::text[]) THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
  END IF;
 END LOOP;
END $functions$;
-- SECURITY DEFINER search_path safety: use immutable pg_catalog first.
-- The remaining functions' unqualified SQL/body logic needs separate
-- source-equivalent review before changing their function-specific settings.
ALTER FUNCTION public.set_assigned_recruiter() SET search_path=pg_catalog,public;
ALTER FUNCTION public.track_stage_changes() SET search_path=pg_catalog,public;

DO $postflight$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_policies
 WHERE schemaname='public' AND tablename=ANY(ARRAY['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles']::text[])
 AND policyname='Allow all for authenticated' AND cmd='ALL';
 IF n<>0 THEN RAISE EXCEPTION 'Universal RLS policies remain: %',n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r' AND c.relname=ANY(ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules']::text[])
 AND has_table_privilege('anon',c.oid,'TRUNCATE');
 IF n<>0 THEN RAISE EXCEPTION 'anon TRUNCATE remains: %',n; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='v' AND c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']::text[])
 AND (has_table_privilege('anon',c.oid,'SELECT') OR NOT
 coalesce('security_invoker=true'=ANY(c.reloptions),false));
 IF n<>0 THEN RAISE EXCEPTION 'Unhardened or exposed views remain: %',n; END IF;
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='public' AND p.prosecdef AND p.proname=ANY(ARRAY['generate_reminders','get_user_role','handle_new_user','has_role','is_approved','on_candidate_stage_change','on_interview_change','on_offer_change','on_submission_insert','resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid','rls_auto_enable','run_workflow_rules','set_assigned_recruiter','track_stage_changes']::text[])
 AND has_function_privilege('anon',p.oid,'EXECUTE');
 IF n<>0 THEN RAISE EXCEPTION 'Anonymous privileged EXECUTE remains: %',n; END IF;
 IF has_column_privilege('anon','public.app_settings','resume_import_folder_url','SELECT')
 THEN RAISE EXCEPTION 'Anonymous Drive folder settings exposed'; END IF;
 IF NOT has_column_privilege('anon','public.app_settings','logo_url','SELECT')
 OR NOT has_column_privilege('anon','public.app_settings','default_color_theme','SELECT')
 THEN RAISE EXCEPTION 'Public branding compatibility broken'; END IF;
END $postflight$;
DO $drop_52_remaining$
DECLARE p record; dropped integer:=0;
BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies
 WHERE schemaname='public' ORDER BY tablename,policyname
 LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
   dropped:=dropped+1;
 END LOOP;
 IF dropped<>52 THEN RAISE EXCEPTION 'Expected 52 remaining legacy policies, found %',dropped; END IF;
END $drop_52_remaining$;
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
-- The four tables omitted by the earlier 15-table PR11 RLS proposal are
-- fail-closed by default. Admin/billing/email operational policy must be approved.
CREATE POLICY public_branding_allowlisted ON public.app_settings FOR SELECT TO anon,authenticated
 USING (true);
CREATE POLICY candidate_stage_history_scoped_read ON public.candidate_stage_history
 FOR SELECT TO authenticated USING (
 public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR EXISTS (
 SELECT 1 FROM public.candidates c
 WHERE c.id=candidate_id AND c.assigned_recruiter=auth.uid()
 )));
CREATE POLICY email_log_admin_read ON public.email_log FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY workflow_rules_admin_manage ON public.workflow_rules FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));

-- Column mutation controls required after table grant cleanup, beyond row RLS.
REVOKE UPDATE ON public.candidates,public.job_openings,public.notifications FROM authenticated;
GRANT UPDATE(stage,notes) ON public.candidates TO authenticated;
GRANT UPDATE(status,priority) ON public.job_openings TO authenticated;
GRANT UPDATE(is_read) ON public.notifications TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.user_roles,public.profiles FROM authenticated;
DO $post_67$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public';
 IF n<>35 THEN RAISE EXCEPTION 'Expected exactly 35 new approved-for-review policies, got %',n; END IF;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND (
    policyname='Allow all for authenticated'
    OR (tablename='candidates' AND policyname='read candidates')
    OR (tablename='billing' AND policyname='read bill')
    OR (tablename='notifications' AND policyname='update notif')
 );
 IF n<>0 THEN RAISE EXCEPTION 'An old permissive authorization policy survived'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
   AND tablename='app_settings' AND policyname='public_branding_allowlisted')
 THEN RAISE EXCEPTION 'Branding RLS compatibility is absent'; END IF;
 IF has_column_privilege('anon','public.app_settings','resume_import_folder_url','SELECT')
 THEN RAISE EXCEPTION 'Private Drive folder exposed despite RLS'; END IF;
END $post_67$;
DO $b48_policy_post$ DECLARE n integer;BEGIN
 SELECT COUNT(*) INTO n FROM pg_policies WHERE schemaname='public';
 IF n<>35 THEN RAISE EXCEPTION 'Full policy replacement produced % not 35',n; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
 AND policyname IN ('read candidates','read bill','self update profile',
 'update notif','public read app settings','Allow all for authenticated')) THEN
  RAISE EXCEPTION 'Old permissive RLS policy survived';
 END IF;
END $b48_policy_post$;
SET ROLE authenticated;
DO $b48_roles$ DECLARE n integer;BEGIN
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 SELECT COUNT(*) INTO n FROM public.candidates;
 IF n<>1 THEN RAISE EXCEPTION 'Recruiter A post-release cross-access: %',n; END IF;
 SELECT COUNT(*) INTO n FROM public.billing;
 IF n<>0 THEN RAISE EXCEPTION 'Recruiter A post-release billed data exposed'; END IF;
 SELECT COUNT(*) INTO n FROM public.email_log;
 IF n<>0 THEN RAISE EXCEPTION 'Recruiter A email log exposed'; END IF;
 BEGIN
  UPDATE public.candidates SET assigned_recruiter='11111111-1111-4111-8111-111111111111';
  RAISE EXCEPTION 'Recruiter transfer update unexpectedly permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.candidates SET notes='Synthetic authorized update'
 WHERE id='11111111-1111-4111-8111-111111111111';
 IF NOT FOUND THEN RAISE EXCEPTION 'Narrow recruiter notes update failed'; END IF;
 BEGIN
  INSERT INTO public.user_roles(user_id,role) VALUES(
   '11111111-1111-4111-8111-111111111111','admin');
  RAISE EXCEPTION 'Self promotion unexpectedly permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 SELECT COUNT(*) INTO n FROM public.candidates;
 IF n<>1 THEN RAISE EXCEPTION 'Recruiter B cross-access: %',n; END IF;
 PERFORM set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 SELECT COUNT(*) INTO n FROM public.candidates;
 IF n<>0 THEN RAISE EXCEPTION 'Inactive recruiter access: %',n; END IF;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 SELECT COUNT(*) INTO n FROM public.candidates;
 IF n<>2 THEN RAISE EXCEPTION 'Admin candidate access missing: %',n; END IF;
 SELECT COUNT(*) INTO n FROM public.billing;
 IF n<>1 THEN RAISE EXCEPTION 'Admin billing access missing: %',n; END IF;
END $b48_roles$;
RESET ROLE;
SET ROLE anon;
DO $b48_anon$ DECLARE n integer;BEGIN
 BEGIN SELECT COUNT(*) INTO n FROM public.candidates;
  RAISE EXCEPTION 'Anonymous candidates read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM resume_import_folder_url FROM public.app_settings;
  RAISE EXCEPTION 'Anonymous private Drive folder read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $b48_anon$;
RESET ROLE;
-- Recovery is a deliberate demonstration of what NOT to deploy. This reinstates
-- the insecure baseline to prove reversible SQL shape, all within ROLLBACK.
SET LOCAL build48.disposable_recovery='on';
DO $recovery_pre$
DECLARE n integer;
BEGIN
 IF current_setting('build48.disposable_recovery',true)<>'on' THEN
    RAISE EXCEPTION 'Recovery SQL may only run inside an explicit disposable test session';
 END IF;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public';
 IF n<>35 THEN RAISE EXCEPTION 'Expected exactly 35 review policies before recovery, found %',n; END IF;
END $recovery_pre$;
DO $drop_review$
DECLARE p record;
BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies
 WHERE schemaname='public'
 LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
END $drop_review$;
-- BUILD48 READ-ONLY LIVE 67-POLICY DEFINITION SNAPSHOT (2026-11-11).
-- REPRODUCE IN SYNTHETIC CI DATABASE ONLY. NOT an active migration.
CREATE POLICY "admin update app settings" ON public."app_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "public read app settings" ON public."app_settings" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Allow all for authenticated" ON public."audit_logs" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "insert audit" ON public."audit_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "read audit" ON public."audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow all for authenticated" ON public."billing" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete bill" ON public."billing" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert bill" ON public."billing" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)));
CREATE POLICY "read bill" ON public."billing" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update bill" ON public."billing" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."candidate_activities" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "read activities" ON public."candidate_activities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "Allow all for authenticated" ON public."candidates" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete candidates" ON public."candidates" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert candidates" ON public."candidates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read candidates" ON public."candidates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update candidates" ON public."candidates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role) OR has_role(auth.uid(), 'operations'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."clients" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete clients" ON public."clients" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert clients" ON public."clients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read clients" ON public."clients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update clients" ON public."clients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "insert email_log" ON public."email_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read email_log" ON public."email_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "Allow all for authenticated" ON public."google_integrations" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin insert own google integration" ON public."google_integrations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "admin select own google integration" ON public."google_integrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "admin update own google integration" ON public."google_integrations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."integrations" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin read integrations" ON public."integrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin write integrations" ON public."integrations" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow all for authenticated" ON public."interviews" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete int" ON public."interviews" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert int" ON public."interviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read int" ON public."interviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update int" ON public."interviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."job_openings" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete jobs" ON public."job_openings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert jobs" ON public."job_openings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read jobs" ON public."job_openings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update jobs" ON public."job_openings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."notifications" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "insert notif" ON public."notifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "read notif" ON public."notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "update notif" ON public."notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = auth.uid()) OR (user_id IS NULL)));
CREATE POLICY "Allow all for authenticated" ON public."offers" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete off" ON public."offers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert off" ON public."offers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role) OR has_role(auth.uid(), 'operations'::app_role)));
CREATE POLICY "read off" ON public."offers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update off" ON public."offers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."profiles" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin delete profiles" ON public."profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update profiles" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "approved read profiles" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_approved(auth.uid()) OR (auth.uid() = id)));
CREATE POLICY "self update profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = id));
CREATE POLICY "Allow all for authenticated" ON public."submissions" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete subs" ON public."submissions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert subs" ON public."submissions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read subs" ON public."submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update subs" ON public."submissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."sync_logs" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin insert sync logs" ON public."sync_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin read sync logs" ON public."sync_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow all for authenticated" ON public."user_roles" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin manage roles" ON public."user_roles" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "self read role" ON public."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "admin manage workflow rules" ON public."workflow_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- READ-ONLY source snapshot direct API grants: 32 table/view objects, 3 API roles.
REVOKE ALL ON TABLE public."app_settings" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."app_settings" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."audit_logs" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."audit_logs" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."available_recruiters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."available_recruiters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."billing" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."billing" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."candidate_activities" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."candidate_activities" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."candidate_stage_history" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."candidate_stage_history" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."candidates" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."candidates" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."candidates_for_assignment" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."candidates_for_assignment" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."clients" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."clients" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."email_log" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."email_log" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."google_integrations" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."google_integrations" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."integrations" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."integrations" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."interviews" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."interviews" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."job_openings" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."job_openings" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."notifications" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."notifications" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."offers" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."offers" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."profiles" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."profiles" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."recruiter_performance" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."recruiter_performance" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."recruiter_performance_with_names" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."recruiter_performance_with_names" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."recruiter_stats" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."recruiter_stats" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."recruiter_summary" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."recruiter_summary" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."submissions" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."submissions" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."sync_logs" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."sync_logs" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."user_roles" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."user_roles" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_billing_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_billing_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_candidate_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_candidate_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_client_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_client_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_interview_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_interview_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_job_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_job_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_offer_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_offer_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_submission_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_submission_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."workflow_rules" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."workflow_rules" TO anon,authenticated,service_role;
-- Restore thirteen view security options from production catalog.
ALTER VIEW public."available_recruiters" RESET (security_invoker);
ALTER VIEW public."candidates_for_assignment" RESET (security_invoker);
ALTER VIEW public."recruiter_performance" RESET (security_invoker);
ALTER VIEW public."recruiter_performance_with_names" RESET (security_invoker);
ALTER VIEW public."recruiter_stats" RESET (security_invoker);
ALTER VIEW public."recruiter_summary" RESET (security_invoker);
ALTER VIEW public."vw_billing_filters" RESET (security_invoker);
ALTER VIEW public."vw_candidate_filters" RESET (security_invoker);
ALTER VIEW public."vw_client_filters" RESET (security_invoker);
ALTER VIEW public."vw_interview_filters" RESET (security_invoker);
ALTER VIEW public."vw_job_filters" RESET (security_invoker);
ALTER VIEW public."vw_offer_filters" RESET (security_invoker);
ALTER VIEW public."vw_submission_filters" RESET (security_invoker);
-- Restore sixteen real SECURITY DEFINER function signatures and caller grants.
REVOKE ALL ON FUNCTION public."generate_reminders"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."generate_reminders"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."generate_reminders"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."get_user_role"(_user_id uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."get_user_role"(_user_id uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."get_user_role"(_user_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public."handle_new_user"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."has_role"(_user_id uuid, _role app_role) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."has_role"(_user_id uuid, _role app_role) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."has_role"(_user_id uuid, _role app_role) TO PUBLIC;
REVOKE ALL ON FUNCTION public."is_approved"(_user_id uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."is_approved"(_user_id uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."is_approved"(_user_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public."on_candidate_stage_change"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."on_candidate_stage_change"() TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."on_interview_change"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."on_interview_change"() TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."on_offer_change"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."on_offer_change"() TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."on_submission_insert"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."on_submission_insert"() TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."resolve_candidate_uuid"(_value text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."resolve_candidate_uuid"(_value text) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."resolve_client_uuid"(_value text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."resolve_client_uuid"(_value text) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."resolve_job_uuid"(_value text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."resolve_job_uuid"(_value text) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."rls_auto_enable"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."rls_auto_enable"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."rls_auto_enable"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."run_workflow_rules"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."run_workflow_rules"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."run_workflow_rules"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."set_assigned_recruiter"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."set_assigned_recruiter"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."set_assigned_recruiter"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."track_stage_changes"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."track_stage_changes"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."track_stage_changes"() TO PUBLIC;
ALTER FUNCTION public.set_assigned_recruiter() RESET search_path;
ALTER FUNCTION public.track_stage_changes() RESET search_path;
REVOKE ALL ON SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA public TO PUBLIC,anon,authenticated,service_role;
DO $recovery_assert$
DECLARE n integer;digest text;
BEGIN
 SELECT count(*),md5(string_agg(
 tablename||E'\x1f'||policyname||E'\x1f'||permissive||E'\x1f'||
 roles::text||E'\x1f'||cmd||E'\x1f'||coalesce(qual,'<NULL>')||E'\x1f'||coalesce(with_check,'<NULL>'),
 E'\n' ORDER BY tablename,policyname))
 INTO n,digest FROM pg_policies WHERE schemaname='public';
 IF n<>67 OR digest<>'a70190f31ed8436b2989082898a02b51' THEN
  RAISE EXCEPTION 'Recovered policy fingerprint mismatch %/%',n,digest; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='v' AND has_table_privilege('anon',c.oid,'SELECT')
 AND NOT (coalesce('security_invoker=true'=ANY(c.reloptions),false))
 AND c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']);
 IF n<>13 THEN RAISE EXCEPTION 'Recovered view privileges mismatch %',n; END IF;
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')
 AND p.proname=ANY(ARRAY['generate_reminders','get_user_role','handle_new_user','has_role','is_approved','on_candidate_stage_change','on_interview_change','on_offer_change','on_submission_insert','resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid','rls_auto_enable','run_workflow_rules','set_assigned_recruiter','track_stage_changes']);
 IF n<>16 THEN RAISE EXCEPTION 'Recovered privileged function count mismatch %',n; END IF;
END $recovery_assert$;
DO $b48_restore$ DECLARE n integer;BEGIN
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public';
 IF n<>67 THEN RAISE EXCEPTION 'Recovered legacy policy count %',n; END IF;
 IF NOT has_table_privilege('anon','public.candidates','TRUNCATE') THEN
  RAISE EXCEPTION 'Expected insecure original anon grant was not restored'; END IF;
 IF NOT has_function_privilege('anon','public.get_user_role(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Expected original sensitive RPC grant was not restored'; END IF;
END $b48_restore$;
SET ROLE authenticated;
DO $b48_restored_leak$ DECLARE n integer;BEGIN
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 SELECT count(*) INTO n FROM public.candidates;
 IF n<>2 THEN RAISE EXCEPTION 'Restored pre-release broad candidate read expected 2, got %',n; END IF;
 SELECT count(*) INTO n FROM public.billing;
 IF n<>1 THEN RAISE EXCEPTION 'Restored pre-release broad billing read expected 1, got %',n; END IF;
END $b48_restored_leak$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS Build48 35-policy lockdown + exact legacy 67-policy emergency recovery in one synthetic ROLLBACK' AS outcome,
 NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relname='candidates') AS no_persistent_candidates;
