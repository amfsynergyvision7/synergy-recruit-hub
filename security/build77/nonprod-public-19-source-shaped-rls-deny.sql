-- Build77 live production CATALOG-ONLY replica for disposable nonproduction structural UAT.
-- DO NOT RUN in production or staging. Does not copy source rows, triggers or defaults.
-- Does not install application functions/views or RLS policies. App access stays denied.
DO $guard$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') OR
 EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m')) OR
 EXISTS (SELECT 1 FROM auth.users) THEN RAISE EXCEPTION 'Build77 refuses nonempty CRM public schema/Auth'; END IF;
 IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname IN ('app_role','candidate_stage','user_status')) THEN RAISE EXCEPTION 'Build77 enum already exists'; END IF;
END $guard$;
CREATE TYPE public."app_role" AS ENUM ('admin', 'recruiter', 'operations', 'finance', 'viewer');
CREATE TYPE public."candidate_stage" AS ENUM ('lead_received', 'contacted', 'interested', 'resume_collected', 'submitted_to_client', 'interview_scheduled', 'interview_completed', 'selected', 'offer_released', 'joined', 'rejected', 'dropped');
CREATE TYPE public."user_status" AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TABLE public."app_settings" (
 "id" integer NOT NULL,
 "logo_url" text,
 "updated_by" uuid,
 "updated_at" timestamp with time zone NOT NULL,
 "resume_import_folder_url" text,
 "default_color_theme" text NOT NULL
);
CREATE TABLE public."audit_logs" (
 "id" uuid NOT NULL,
 "user_id" uuid,
 "user_email" text,
 "action" text NOT NULL,
 "table_name" text,
 "record_id" text,
 "details" jsonb,
 "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."billing" (
 "id" uuid NOT NULL,
 "invoice_number" text,
 "candidate_id" uuid,
 "client_id" uuid,
 "salary" numeric,
 "placement_fee" numeric,
 "gst" numeric,
 "invoice_amount" numeric,
 "payment_status" text,
 "outstanding_amount" numeric,
 "invoice_date" date,
 "created_by" uuid,
 "created_at" timestamp with time zone NOT NULL,
 "updated_at" timestamp with time zone NOT NULL,
 "candidate_uuid" uuid,
 "client_uuid" uuid,
 "offer_uuid" uuid
);
CREATE TABLE public."candidate_activities" (
 "id" uuid NOT NULL,
 "candidate_id" uuid NOT NULL,
 "candidate_name" text,
 "recruiter_id" uuid,
 "recruiter_name" text,
 "action_type" text NOT NULL,
 "module_created" text,
 "related_record_id" uuid,
 "notes" text,
 "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."candidate_stage_history" (
 "id" uuid NOT NULL,
 "candidate_id" uuid,
 "previous_stage" text,
 "new_stage" text NOT NULL,
 "changed_by" uuid,
 "notes" text,
 "created_at" timestamp with time zone
);
CREATE TABLE public."candidates" (
 "id" uuid NOT NULL,
 "candidate_code" text,
 "full_name" text NOT NULL,
 "mobile" text,
 "email" text,
 "location" text,
 "position_applied" text,
 "current_company" text,
 "experience_years" numeric,
 "current_salary" numeric,
 "expected_salary" numeric,
 "notice_period" text,
 "resume_url" text,
 "source" text,
 "assigned_recruiter" uuid,
 "stage" public.candidate_stage NOT NULL,
 "notes" text,
 "created_by" uuid,
 "created_at" timestamp with time zone NOT NULL,
 "updated_at" timestamp with time zone NOT NULL,
 "status" text NOT NULL,
 "created_source" text,
 "resume_summary" text,
 "ats_score" integer,
 "ats_issues" jsonb,
 "ats_checked_at" timestamp with time zone
);
CREATE TABLE public."clients" (
 "id" uuid NOT NULL,
 "company_name" text NOT NULL,
 "contact_person" text,
 "phone" text,
 "email" text,
 "active_positions" integer,
 "agreement_type" text,
 "billing_model" text,
 "status" text,
 "created_by" uuid,
 "created_at" timestamp with time zone NOT NULL,
 "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."email_log" (
 "id" uuid NOT NULL,
 "related_table" text NOT NULL,
 "related_id" uuid NOT NULL,
 "to_email" text NOT NULL,
 "subject" text NOT NULL,
 "body" text NOT NULL,
 "status" text NOT NULL,
 "error" text,
 "provider_id" text,
 "sent_by" uuid,
 "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."google_integrations" (
 "id" uuid NOT NULL,
 "sheet_url" text,
 "spreadsheet_id" text,
 "sheet_name" text NOT NULL,
 "header_row" integer NOT NULL,
 "auto_sync_enabled" boolean NOT NULL,
 "sync_frequency_minutes" integer NOT NULL,
 "last_sync" timestamp with time zone,
 "last_synced_row" integer NOT NULL,
 "google_account_email" text,
 "connection_status" text NOT NULL,
 "column_mapping" jsonb NOT NULL,
 "last_error" text,
 "created_at" timestamp with time zone NOT NULL,
 "updated_at" timestamp with time zone NOT NULL,
 "user_id" uuid NOT NULL,
 "mapping" jsonb NOT NULL
);
CREATE TABLE public."integrations" (
 "id" uuid NOT NULL,
 "module" text NOT NULL,
 "sheet_url" text,
 "spreadsheet_id" text,
 "sheet_name" text,
 "header_row" integer NOT NULL,
 "column_mapping" jsonb NOT NULL,
 "auto_sync" boolean NOT NULL,
 "last_sync_at" timestamp with time zone,
 "last_synced_row" integer NOT NULL,
 "last_status" text,
 "last_error" text,
 "created_at" timestamp with time zone NOT NULL,
 "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."interviews" (
 "id" uuid NOT NULL,
 "candidate_id" uuid NOT NULL,
 "client_id" uuid,
 "round" text,
 "interview_date" date,
 "interview_time" time without time zone,
 "mode" text,
 "feedback" text,
 "status" text,
 "created_by" uuid,
 "created_at" timestamp with time zone NOT NULL,
 "candidate_uuid" uuid,
 "client_uuid" uuid,
 "submission_uuid" uuid,
 "scheduling_token" uuid,
 "proposed_slots" jsonb
);
CREATE TABLE public."job_openings" (
 "id" uuid NOT NULL,
 "job_title" text NOT NULL,
 "client_id" uuid,
 "location" text,
 "salary_min" numeric,
 "salary_max" numeric,
 "assigned_recruiter" uuid,
 "open_positions" integer,
 "priority" text,
 "status" text,
 "created_by" uuid,
 "created_at" timestamp with time zone NOT NULL,
 "updated_at" timestamp with time zone NOT NULL,
 "client_uuid" uuid,
 "requirements" text,
 "description" text,
 "is_confidential" boolean NOT NULL
);
CREATE TABLE public."notifications" (
 "id" uuid NOT NULL,
 "user_id" uuid,
 "title" text NOT NULL,
 "message" text,
 "type" text,
 "is_read" boolean,
 "created_at" timestamp with time zone NOT NULL,
 "related_table" text,
 "related_id" uuid
);
CREATE TABLE public."offers" (
 "id" uuid NOT NULL,
 "candidate_id" uuid NOT NULL,
 "client_id" uuid,
 "offer_date" date,
 "joining_date" date,
 "salary" numeric,
 "ctc" numeric,
 "offer_status" text,
 "joining_status" text,
 "created_by" uuid,
 "created_at" timestamp with time zone NOT NULL,
 "updated_at" timestamp with time zone NOT NULL,
 "candidate_uuid" uuid,
 "client_uuid" uuid,
 "submission_uuid" uuid,
 "interview_uuid" uuid
);
CREATE TABLE public."profiles" (
 "id" uuid NOT NULL,
 "full_name" text NOT NULL,
 "email" text NOT NULL,
 "phone" text,
 "department" text,
 "role_request" text,
 "status" public.user_status NOT NULL,
 "is_active" boolean NOT NULL,
 "created_at" timestamp with time zone NOT NULL,
 "updated_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."submissions" (
 "id" uuid NOT NULL,
 "candidate_id" uuid NOT NULL,
 "client_id" uuid,
 "job_id" uuid,
 "role_title" text,
 "submission_date" date,
 "status" text,
 "remarks" text,
 "created_by" uuid,
 "created_at" timestamp with time zone NOT NULL,
 "candidate_uuid" uuid,
 "client_uuid" uuid,
 "job_uuid" uuid
);
CREATE TABLE public."sync_logs" (
 "id" uuid NOT NULL,
 "module" text NOT NULL,
 "triggered_by" text NOT NULL,
 "rows_scanned" integer NOT NULL,
 "rows_created" integer NOT NULL,
 "rows_updated" integer NOT NULL,
 "rows_skipped" integer NOT NULL,
 "errors" jsonb NOT NULL,
 "status" text NOT NULL,
 "message" text,
 "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."user_roles" (
 "id" uuid NOT NULL,
 "user_id" uuid NOT NULL,
 "role" public.app_role NOT NULL,
 "created_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."workflow_rules" (
 "id" uuid NOT NULL,
 "name" text NOT NULL,
 "table_name" text NOT NULL,
 "field_name" text NOT NULL,
 "field_value" text NOT NULL,
 "action_type" text NOT NULL,
 "notify_target" text,
 "notify_title" text,
 "notify_message" text,
 "update_field_name" text,
 "update_field_value" text,
 "is_active" boolean NOT NULL,
 "created_by" uuid,
 "created_at" timestamp with time zone NOT NULL,
 "updated_at" timestamp with time zone NOT NULL
);
ALTER TABLE public."app_settings" ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY (id);
ALTER TABLE public."app_settings" ADD CONSTRAINT "app_settings_singleton" CHECK (id = 1);
ALTER TABLE public."app_settings" ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."billing" ADD CONSTRAINT "billing_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;
ALTER TABLE public."billing" ADD CONSTRAINT "billing_candidate_uuid_fkey" FOREIGN KEY (candidate_uuid) REFERENCES candidates(id) ON DELETE SET NULL;
ALTER TABLE public."billing" ADD CONSTRAINT "billing_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."billing" ADD CONSTRAINT "billing_client_uuid_fkey" FOREIGN KEY (client_uuid) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."billing" ADD CONSTRAINT "billing_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."billing" ADD CONSTRAINT "billing_invoice_number_key" UNIQUE (invoice_number);
ALTER TABLE public."billing" ADD CONSTRAINT "billing_offer_uuid_fkey" FOREIGN KEY (offer_uuid) REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE public."billing" ADD CONSTRAINT "billing_pkey" PRIMARY KEY (id);
ALTER TABLE public."candidate_activities" ADD CONSTRAINT "candidate_activities_pkey" PRIMARY KEY (id);
ALTER TABLE public."candidate_stage_history" ADD CONSTRAINT "candidate_stage_history_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public."candidate_stage_history" ADD CONSTRAINT "candidate_stage_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES profiles(id);
ALTER TABLE public."candidate_stage_history" ADD CONSTRAINT "candidate_stage_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."candidates" ADD CONSTRAINT "candidates_assigned_recruiter_fkey" FOREIGN KEY (assigned_recruiter) REFERENCES auth.users(id);
ALTER TABLE public."candidates" ADD CONSTRAINT "candidates_candidate_code_key" UNIQUE (candidate_code);
ALTER TABLE public."candidates" ADD CONSTRAINT "candidates_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."candidates" ADD CONSTRAINT "candidates_pkey" PRIMARY KEY (id);
ALTER TABLE public."clients" ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."clients" ADD CONSTRAINT "clients_pkey" PRIMARY KEY (id);
ALTER TABLE public."email_log" ADD CONSTRAINT "email_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."email_log" ADD CONSTRAINT "email_log_sent_by_fkey" FOREIGN KEY (sent_by) REFERENCES auth.users(id);
ALTER TABLE public."google_integrations" ADD CONSTRAINT "google_integrations_header_row_positive" CHECK (header_row >= 1);
ALTER TABLE public."google_integrations" ADD CONSTRAINT "google_integrations_last_synced_row_positive" CHECK (last_synced_row >= 1);
ALTER TABLE public."google_integrations" ADD CONSTRAINT "google_integrations_singleton" PRIMARY KEY (id);
ALTER TABLE public."google_integrations" ADD CONSTRAINT "google_integrations_sync_frequency_positive" CHECK (sync_frequency_minutes >= 1);
ALTER TABLE public."google_integrations" ADD CONSTRAINT "google_integrations_user_id_key" UNIQUE (user_id);
ALTER TABLE public."integrations" ADD CONSTRAINT "integrations_module_key" UNIQUE (module);
ALTER TABLE public."integrations" ADD CONSTRAINT "integrations_pkey" PRIMARY KEY (id);
ALTER TABLE public."interviews" ADD CONSTRAINT "interviews_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public."interviews" ADD CONSTRAINT "interviews_candidate_uuid_fkey" FOREIGN KEY (candidate_uuid) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public."interviews" ADD CONSTRAINT "interviews_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."interviews" ADD CONSTRAINT "interviews_client_uuid_fkey" FOREIGN KEY (client_uuid) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."interviews" ADD CONSTRAINT "interviews_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."interviews" ADD CONSTRAINT "interviews_pkey" PRIMARY KEY (id);
ALTER TABLE public."interviews" ADD CONSTRAINT "interviews_submission_uuid_fkey" FOREIGN KEY (submission_uuid) REFERENCES submissions(id) ON DELETE SET NULL;
ALTER TABLE public."job_openings" ADD CONSTRAINT "job_openings_assigned_recruiter_fkey" FOREIGN KEY (assigned_recruiter) REFERENCES auth.users(id);
ALTER TABLE public."job_openings" ADD CONSTRAINT "job_openings_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."job_openings" ADD CONSTRAINT "job_openings_client_uuid_fkey" FOREIGN KEY (client_uuid) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."job_openings" ADD CONSTRAINT "job_openings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."job_openings" ADD CONSTRAINT "job_openings_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_related_type_unique" UNIQUE (related_table, related_id, type);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."offers" ADD CONSTRAINT "offers_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public."offers" ADD CONSTRAINT "offers_candidate_uuid_fkey" FOREIGN KEY (candidate_uuid) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public."offers" ADD CONSTRAINT "offers_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."offers" ADD CONSTRAINT "offers_client_uuid_fkey" FOREIGN KEY (client_uuid) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."offers" ADD CONSTRAINT "offers_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."offers" ADD CONSTRAINT "offers_interview_uuid_fkey" FOREIGN KEY (interview_uuid) REFERENCES interviews(id) ON DELETE SET NULL;
ALTER TABLE public."offers" ADD CONSTRAINT "offers_pkey" PRIMARY KEY (id);
ALTER TABLE public."offers" ADD CONSTRAINT "offers_submission_uuid_fkey" FOREIGN KEY (submission_uuid) REFERENCES submissions(id) ON DELETE SET NULL;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_email_key" UNIQUE (email);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_candidate_uuid_fkey" FOREIGN KEY (candidate_uuid) REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_client_uuid_fkey" FOREIGN KEY (client_uuid) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_job_id_fkey" FOREIGN KEY (job_id) REFERENCES job_openings(id) ON DELETE SET NULL;
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_job_uuid_fkey" FOREIGN KEY (job_uuid) REFERENCES job_openings(id) ON DELETE SET NULL;
ALTER TABLE public."submissions" ADD CONSTRAINT "submissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."sync_logs" ADD CONSTRAINT "sync_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE (user_id, role);
ALTER TABLE public."workflow_rules" ADD CONSTRAINT "workflow_rules_action_type_check" CHECK (action_type = ANY (ARRAY['notify'::text, 'update_field'::text]));
ALTER TABLE public."workflow_rules" ADD CONSTRAINT "workflow_rules_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."workflow_rules" ADD CONSTRAINT "workflow_rules_notify_target_check" CHECK (notify_target = ANY (ARRAY['assigned_recruiter'::text, 'role:admin'::text, 'role:recruiter'::text, 'role:operations'::text, 'role:finance'::text, 'role:viewer'::text]));
ALTER TABLE public."workflow_rules" ADD CONSTRAINT "workflow_rules_pkey" PRIMARY KEY (id);
ALTER TABLE public."workflow_rules" ADD CONSTRAINT "workflow_rules_table_name_check" CHECK (table_name = ANY (ARRAY['candidates'::text, 'submissions'::text, 'interviews'::text, 'offers'::text, 'billing'::text, 'clients'::text]));
ALTER TABLE public."app_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."app_settings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."app_settings" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_logs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."audit_logs" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."billing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."billing" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."billing" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."candidate_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."candidate_activities" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."candidate_activities" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."candidate_stage_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."candidate_stage_history" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."candidate_stage_history" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."candidates" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."candidates" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."clients" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."clients" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."email_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."email_log" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."email_log" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."google_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."google_integrations" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."google_integrations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."integrations" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."integrations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."interviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."interviews" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."interviews" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."job_openings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."job_openings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."job_openings" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."notifications" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."offers" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."offers" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."profiles" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."submissions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."submissions" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."sync_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sync_logs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."sync_logs" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_roles" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."user_roles" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."workflow_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."workflow_rules" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."workflow_rules" FROM PUBLIC, anon, authenticated;
-- No seeding, no application grants, no triggers, no email/sync/finance routines.
-- 19 tables, 239 columns, 75 source catalog constraints, 3 enum types.
