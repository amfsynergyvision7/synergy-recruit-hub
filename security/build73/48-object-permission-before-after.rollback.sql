-- Build73: 48-object permission preflight before/after in DISPOSABLE PostgreSQL 17 ONLY.
-- Actual live table/view SQL shapes + stubbed (not executable real) privileged function bodies.
-- One transaction, one unconditional ROLLBACK, no hosted/staging/production writes.
BEGIN;
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;
DO $b73_disposable_guard$
BEGIN
 IF current_database()<>'amf_build73_permissions_lab' THEN
  RAISE EXCEPTION 'Build73 refuses anything except exact disposable CI database';
 END IF;
END $b73_disposable_guard$;
CREATE ROLE b73_anon NOLOGIN;
CREATE ROLE b73_authenticated NOLOGIN;
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
CREATE FUNCTION public.generate_reminders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN; END; $code$;
CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.is_approved(_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.on_candidate_stage_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.on_interview_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.on_offer_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.on_submission_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.resolve_candidate_uuid(_value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.resolve_client_uuid(_value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.resolve_job_uuid(_value text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NULL; END; $code$;
CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN; END; $code$;
CREATE FUNCTION public.run_workflow_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.set_assigned_recruiter() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE FUNCTION public.track_stage_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $code$ BEGIN RETURN NEW; END; $code$;
CREATE VIEW public.available_recruiters AS
SELECT id,
    full_name,
    email,
    'Available'::text AS status
   FROM profiles
  WHERE status = 'approved'::user_status
  ORDER BY full_name;
CREATE VIEW public.candidates_for_assignment AS
SELECT id,
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
CREATE VIEW public.recruiter_performance AS
SELECT p.id AS recruiter_id,
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
CREATE VIEW public.recruiter_performance_with_names AS
SELECT p.full_name AS recruiter_name,
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
CREATE VIEW public.recruiter_stats AS
SELECT p.id,
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
CREATE VIEW public.recruiter_summary AS
SELECT p.full_name AS recruiter,
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
CREATE VIEW public.vw_billing_filters AS
SELECT id,
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
CREATE VIEW public.vw_candidate_filters AS
SELECT id,
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
CREATE VIEW public.vw_client_filters AS
SELECT id,
    company_name,
    contact_person,
    status,
    agreement_type,
    billing_model,
    active_positions,
    created_at
   FROM clients;
CREATE VIEW public.vw_interview_filters AS
SELECT id,
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
CREATE VIEW public.vw_job_filters AS
SELECT id,
    job_title,
    location,
    priority,
    status,
    assigned_recruiter,
    open_positions,
    created_at
   FROM job_openings;
CREATE VIEW public.vw_offer_filters AS
SELECT id,
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
CREATE VIEW public.vw_submission_filters AS
SELECT id,
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
GRANT TRUNCATE ON public.app_settings, public.audit_logs, public.billing, public.candidate_activities, public.candidate_stage_history, public.candidates, public.clients, public.email_log, public.google_integrations, public.integrations, public.interviews, public.job_openings, public.notifications, public.offers, public.profiles, public.submissions, public.sync_logs, public.user_roles, public.workflow_rules TO b73_anon,b73_authenticated;
GRANT SELECT ON public.available_recruiters, public.candidates_for_assignment, public.recruiter_performance, public.recruiter_performance_with_names, public.recruiter_stats, public.recruiter_summary, public.vw_billing_filters, public.vw_candidate_filters, public.vw_client_filters, public.vw_interview_filters, public.vw_job_filters, public.vw_offer_filters, public.vw_submission_filters TO b73_anon,b73_authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO b73_anon,b73_authenticated;
GRANT EXECUTE ON FUNCTION public.generate_reminders(), public.get_user_role(uuid), public.handle_new_user(), public.has_role(uuid,public.app_role), public.is_approved(uuid), public.rls_auto_enable(), public.run_workflow_rules(), public.set_assigned_recruiter(), public.track_stage_changes() TO PUBLIC;
-- Reuse exact live catalog-only preflight with role name translation ONLY inside disposable PG.
CREATE TEMP VIEW b73_permissions_gate AS
-- Build73 READ-ONLY catalog-only 48-object permission preflight.
-- Never authorizes release, never reads person/business rows, never mutates DB.
-- Expects exact current public object names/signatures and no extra privileged functions.
-- A PASS only verifies limited permissions, not 35-policy, finance, legal, restore or hosted UAT gates.
WITH expected_tables(name) AS (VALUES
  ('app_settings'),
  ('audit_logs'),
  ('billing'),
  ('candidate_activities'),
  ('candidate_stage_history'),
  ('candidates'),
  ('clients'),
  ('email_log'),
  ('google_integrations'),
  ('integrations'),
  ('interviews'),
  ('job_openings'),
  ('notifications'),
  ('offers'),
  ('profiles'),
  ('submissions'),
  ('sync_logs'),
  ('user_roles'),
  ('workflow_rules')
), expected_views(name) AS (VALUES
  ('available_recruiters'),
  ('candidates_for_assignment'),
  ('recruiter_performance'),
  ('recruiter_performance_with_names'),
  ('recruiter_stats'),
  ('recruiter_summary'),
  ('vw_billing_filters'),
  ('vw_candidate_filters'),
  ('vw_client_filters'),
  ('vw_interview_filters'),
  ('vw_job_filters'),
  ('vw_offer_filters'),
  ('vw_submission_filters')
), expected_functions(signature) AS (VALUES
  ('public.generate_reminders()'),
  ('public.get_user_role(uuid)'),
  ('public.handle_new_user()'),
  ('public.has_role(uuid,public.app_role)'),
  ('public.is_approved(uuid)'),
  ('public.on_candidate_stage_change()'),
  ('public.on_interview_change()'),
  ('public.on_offer_change()'),
  ('public.on_submission_insert()'),
  ('public.resolve_candidate_uuid(text)'),
  ('public.resolve_client_uuid(text)'),
  ('public.resolve_job_uuid(text)'),
  ('public.rls_auto_enable()'),
  ('public.run_workflow_rules()'),
  ('public.set_assigned_recruiter()'),
  ('public.track_stage_changes()')
), tab AS (
 SELECT e.name,c.oid,c.relrowsecurity,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('b73_anon',c.oid,'TRUNCATE') END AS anon_truncate,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('b73_authenticated',c.oid,'TRUNCATE') END AS auth_truncate
 FROM expected_tables e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
 AND c.relname=e.name AND c.relkind IN ('r','p')
), vw AS (
 SELECT e.name,c.oid,
 CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('b73_anon',c.oid,'SELECT') END AS anon_select,
 CASE WHEN c.oid IS NULL THEN NULL ELSE COALESCE(c.reloptions @> ARRAY['security_invoker=true']::text[],false) END AS invoker
 FROM expected_views e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
 AND c.relname=e.name AND c.relkind='v'
), fun AS (
 SELECT e.signature,p.oid,p.prosecdef,
 CASE WHEN p.oid IS NULL THEN NULL ELSE has_function_privilege('b73_anon',p.oid,'EXECUTE') END AS anon_execute,
 CASE WHEN p.oid IS NULL THEN NULL ELSE has_function_privilege('b73_authenticated',p.oid,'EXECUTE') END AS auth_execute,
 CASE WHEN p.oid IS NULL THEN NULL ELSE EXISTS(
  SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
  WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'
 ) END AS public_execute
 FROM expected_functions e
 LEFT JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure(e.signature)
), aggregate AS (
 SELECT
 (SELECT count(*) FROM tab WHERE oid IS NOT NULL) AS matched_tables,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')) AS actual_public_tables,
 (SELECT count(*) FROM tab WHERE oid IS NOT NULL AND relrowsecurity) AS tables_rls_enabled,
 (SELECT count(*) FROM tab WHERE anon_truncate IS TRUE) AS anon_truncate_tables,
 (SELECT count(*) FROM tab WHERE auth_truncate IS TRUE) AS authenticated_truncate_tables,
 (SELECT count(*) FROM vw WHERE oid IS NOT NULL) AS matched_views,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='v') AS actual_public_views,
 (SELECT count(*) FROM vw WHERE invoker IS TRUE) AS invoker_views,
 (SELECT count(*) FROM vw WHERE anon_select IS TRUE) AS anonymous_readable_views,
 (SELECT count(*) FROM fun WHERE oid IS NOT NULL AND prosecdef) AS matched_privileged_functions,
 (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef) AS actual_privileged_functions,
 (SELECT count(*) FROM fun WHERE anon_execute IS TRUE) AS anonymous_executable_functions,
 (SELECT count(*) FROM fun WHERE public_execute IS TRUE) AS public_executable_functions,
 (SELECT count(*) FROM fun WHERE auth_execute IS TRUE) AS authenticated_executable_functions
)
SELECT *,
 CASE WHEN matched_tables=19 AND actual_public_tables=19 AND tables_rls_enabled=19
 AND anon_truncate_tables=0 AND authenticated_truncate_tables=0
 AND matched_views=13 AND actual_public_views=13 AND invoker_views=13
 AND anonymous_readable_views=0
 AND matched_privileged_functions=16 AND actual_privileged_functions=16
 AND anonymous_executable_functions=0 AND public_executable_functions=0
 AND authenticated_executable_functions=3
 THEN 'PERMISSIONS_POSTFLIGHT_PASS_NOT_A_RELEASE_APPROVAL'
 ELSE 'HOLD_48_OBJECT_PERMISSIONS_NOT_SAFE_OR_SCOPE_DRIFT'
 END AS permissions_gate
FROM aggregate;
DO $old$
DECLARE p record;
BEGIN
 SELECT * INTO p FROM b73_permissions_gate;
 IF p.permissions_gate <> 'HOLD_48_OBJECT_PERMISSIONS_NOT_SAFE_OR_SCOPE_DRIFT' OR
 p.matched_tables <> 19 OR p.matched_views <> 13 OR p.matched_privileged_functions <> 16 OR
 p.anon_truncate_tables <> 19 OR p.authenticated_truncate_tables <> 19 OR
 p.anonymous_readable_views <> 13 OR p.invoker_views <> 0 OR
 p.anonymous_executable_functions <> 16 OR p.public_executable_functions <> 9 OR
 p.authenticated_executable_functions <> 16 THEN
 RAISE EXCEPTION 'Baseline permission drift: %',row_to_json(p); END IF;
END $old$;
-- Apply only the planned permission changes in this temporary, fully invented database.
REVOKE TRUNCATE ON public.app_settings, public.audit_logs, public.billing, public.candidate_activities, public.candidate_stage_history, public.candidates, public.clients, public.email_log, public.google_integrations, public.integrations, public.interviews, public.job_openings, public.notifications, public.offers, public.profiles, public.submissions, public.sync_logs, public.user_roles, public.workflow_rules FROM PUBLIC,b73_anon,b73_authenticated;
ALTER VIEW public.available_recruiters SET (security_invoker=true);
ALTER VIEW public.candidates_for_assignment SET (security_invoker=true);
ALTER VIEW public.recruiter_performance SET (security_invoker=true);
ALTER VIEW public.recruiter_performance_with_names SET (security_invoker=true);
ALTER VIEW public.recruiter_stats SET (security_invoker=true);
ALTER VIEW public.recruiter_summary SET (security_invoker=true);
ALTER VIEW public.vw_billing_filters SET (security_invoker=true);
ALTER VIEW public.vw_candidate_filters SET (security_invoker=true);
ALTER VIEW public.vw_client_filters SET (security_invoker=true);
ALTER VIEW public.vw_interview_filters SET (security_invoker=true);
ALTER VIEW public.vw_job_filters SET (security_invoker=true);
ALTER VIEW public.vw_offer_filters SET (security_invoker=true);
ALTER VIEW public.vw_submission_filters SET (security_invoker=true);
REVOKE SELECT ON public.available_recruiters, public.candidates_for_assignment, public.recruiter_performance, public.recruiter_performance_with_names, public.recruiter_stats, public.recruiter_summary, public.vw_billing_filters, public.vw_candidate_filters, public.vw_client_filters, public.vw_interview_filters, public.vw_job_filters, public.vw_offer_filters, public.vw_submission_filters FROM PUBLIC,b73_anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,b73_anon,b73_authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid),public.has_role(uuid,public.app_role),public.is_approved(uuid) TO b73_authenticated;
DO $new$
DECLARE p record;
BEGIN
 SELECT * INTO p FROM b73_permissions_gate;
 IF p.permissions_gate <> 'PERMISSIONS_POSTFLIGHT_PASS_NOT_A_RELEASE_APPROVAL' OR
 p.matched_tables <> 19 OR p.tables_rls_enabled <> 19 OR
 p.anon_truncate_tables <> 0 OR p.authenticated_truncate_tables <> 0 OR
 p.matched_views <> 13 OR p.invoker_views <> 13 OR p.anonymous_readable_views <> 0 OR
 p.matched_privileged_functions <> 16 OR p.anonymous_executable_functions <> 0 OR
 p.public_executable_functions <> 0 OR p.authenticated_executable_functions <> 3 THEN
 RAISE EXCEPTION 'Permission postflight incomplete: %',row_to_json(p); END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public')<>0 THEN
  RAISE EXCEPTION 'No policy replacement was performed in this permission-only test'; END IF;
END $new$;
-- Production 67->35 policies, finance/legal, backup, owner approval and hosted UAT remain UNTESTED here.
ROLLBACK;
