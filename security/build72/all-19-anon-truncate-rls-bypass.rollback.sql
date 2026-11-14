-- Build72 SYNTHETIC DISPOSABLE PostgreSQL 17 ONLY.
-- Actual 19 production-derived source table definitions; invented ID-only records.
-- Never execute against hosted production or nonproduction. No side-effect triggers.
BEGIN;
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
CREATE ROLE b72_anon NOLOGIN;
GRANT USAGE ON SCHEMA public TO b72_anon;
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
INSERT INTO public.app_settings("id") VALUES (1);
INSERT INTO public.audit_logs("id") VALUES ('b7200000-0000-4000-8000-000000000002');
INSERT INTO public.billing("id") VALUES ('b7200000-0000-4000-8000-000000000003');
INSERT INTO public.candidate_activities("id") VALUES ('b7200000-0000-4000-8000-000000000004');
INSERT INTO public.candidate_stage_history("id") VALUES ('b7200000-0000-4000-8000-000000000005');
INSERT INTO public.candidates("id") VALUES ('b7200000-0000-4000-8000-000000000006');
INSERT INTO public.clients("id") VALUES ('b7200000-0000-4000-8000-000000000007');
INSERT INTO public.email_log("id") VALUES ('b7200000-0000-4000-8000-000000000008');
INSERT INTO public.google_integrations("id") VALUES ('b7200000-0000-4000-8000-000000000009');
INSERT INTO public.integrations("id") VALUES ('b7200000-0000-4000-8000-00000000000a');
INSERT INTO public.interviews("id") VALUES ('b7200000-0000-4000-8000-00000000000b');
INSERT INTO public.job_openings("id") VALUES ('b7200000-0000-4000-8000-00000000000c');
INSERT INTO public.notifications("id") VALUES ('b7200000-0000-4000-8000-00000000000d');
INSERT INTO public.offers("id") VALUES ('b7200000-0000-4000-8000-00000000000e');
INSERT INTO public.profiles("id") VALUES ('b7200000-0000-4000-8000-00000000000f');
INSERT INTO public.submissions("id") VALUES ('b7200000-0000-4000-8000-000000000010');
INSERT INTO public.sync_logs("id") VALUES ('b7200000-0000-4000-8000-000000000011');
INSERT INTO public.user_roles("id") VALUES ('b7200000-0000-4000-8000-000000000012');
INSERT INTO public.workflow_rules("id") VALUES ('b7200000-0000-4000-8000-000000000013');
DO $seed$
DECLARE t text; n bigint;
BEGIN
 FOREACH t IN ARRAY ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'Synthetic table % expected 1 invented row, found %',t,n; END IF;
 END LOOP;
END $seed$;
-- Risk rehearsal: a caller denied table rows by RLS may still DELETE ALL via TRUNCATE.
GRANT SELECT ON public.billing TO b72_anon;
GRANT TRUNCATE ON public.app_settings, public.audit_logs, public.billing, public.candidate_activities, public.candidate_stage_history, public.candidates, public.clients, public.email_log, public.google_integrations, public.integrations, public.interviews, public.job_openings, public.notifications, public.offers, public.profiles, public.submissions, public.sync_logs, public.user_roles, public.workflow_rules TO b72_anon;
SET LOCAL ROLE b72_anon;
DO $attack$
DECLARE t text; n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.billing;
 IF n<>0 THEN RAISE EXCEPTION 'RLS should hide the synthetic billing row from b72_anon'; END IF;
 FOREACH t IN ARRAY ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules'] LOOP
  IF NOT has_table_privilege(current_user,format('public.%I',t),'TRUNCATE') THEN
   RAISE EXCEPTION 'Missing synthetic TRUNCATE privilege on %',t;
  END IF;
  EXECUTE format('TRUNCATE TABLE public.%I',t);
 END LOOP;
END $attack$;
RESET ROLE;
DO $cleared$
DECLARE t text; n bigint;
BEGIN
 FOREACH t IN ARRAY ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'TRUNCATE did not remove invented row on %, count %',t,n; END IF;
 END LOOP;
END $cleared$;
-- Proposed mitigation: REVOKE explicit TRUNCATE for exposed roles.
REVOKE TRUNCATE ON public.app_settings, public.audit_logs, public.billing, public.candidate_activities, public.candidate_stage_history, public.candidates, public.clients, public.email_log, public.google_integrations, public.integrations, public.interviews, public.job_openings, public.notifications, public.offers, public.profiles, public.submissions, public.sync_logs, public.user_roles, public.workflow_rules FROM b72_anon;
SET LOCAL ROLE b72_anon;
DO $secure$
DECLARE t text; refused boolean;
BEGIN
 FOREACH t IN ARRAY ARRAY['app_settings','audit_logs','billing','candidate_activities','candidate_stage_history','candidates','clients','email_log','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles','workflow_rules'] LOOP
  refused:=false;
  BEGIN
   EXECUTE format('TRUNCATE TABLE public.%I',t);
  EXCEPTION WHEN insufficient_privilege THEN
   refused:=true;
  END;
  IF NOT refused OR has_table_privilege(current_user,format('public.%I',t),'TRUNCATE') THEN
   RAISE EXCEPTION 'Anonymous TRUNCATE still possible on %',t;
  END IF;
 END LOOP;
END $secure$;
RESET ROLE;
ROLLBACK;
