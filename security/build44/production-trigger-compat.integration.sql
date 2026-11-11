BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
SET LOCAL statement_timeout='35s';
-- BUILD 44: source-derived from READ-ONLY production PostgreSQL catalog on 11 November 2026.
-- Seven actual current trigger function definitions plus all nine candidate/integration triggers.
-- 19 table shapes (239 columns) are synthetic: not production constraints, data or grants.
-- Disposable CI / one-transaction ROLLBACK only. Not a deployable migration.
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.candidate_stage AS ENUM('lead_received','contacted','interested','resume_collected','submitted_to_client','interview_scheduled','interview_completed','selected','offer_released','joined','rejected','dropped');
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected','suspended');
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE SEQUENCE public.candidate_code_seq;
CREATE TABLE public.app_settings (
  "id" int4,
  "logo_url" text,
  "updated_by" uuid,
  "updated_at" timestamptz,
  "resume_import_folder_url" text,
  "default_color_theme" text
);
CREATE TABLE public.audit_logs (
  "id" uuid,
  "user_id" uuid,
  "user_email" text,
  "action" text,
  "table_name" text,
  "record_id" text,
  "details" jsonb,
  "created_at" timestamptz
);
CREATE TABLE public.billing (
  "id" uuid,
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
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "candidate_uuid" uuid,
  "client_uuid" uuid,
  "offer_uuid" uuid
);
CREATE TABLE public.candidate_activities (
  "id" uuid,
  "candidate_id" uuid,
  "candidate_name" text,
  "recruiter_id" uuid,
  "recruiter_name" text,
  "action_type" text,
  "module_created" text,
  "related_record_id" uuid,
  "notes" text,
  "created_at" timestamptz
);
CREATE TABLE public.candidate_stage_history (
  "id" uuid DEFAULT gen_random_uuid(),
  "candidate_id" uuid,
  "previous_stage" text,
  "new_stage" text,
  "changed_by" uuid,
  "notes" text,
  "created_at" timestamptz
);
CREATE TABLE public.candidates (
  "id" uuid DEFAULT gen_random_uuid(),
  "candidate_code" text,
  "full_name" text,
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
  "stage" public.candidate_stage,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "status" text,
  "created_source" text,
  "resume_summary" text,
  "ats_score" int4,
  "ats_issues" jsonb,
  "ats_checked_at" timestamptz
);
CREATE TABLE public.clients (
  "id" uuid,
  "company_name" text,
  "contact_person" text,
  "phone" text,
  "email" text,
  "active_positions" int4,
  "agreement_type" text,
  "billing_model" text,
  "status" text,
  "created_by" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
CREATE TABLE public.email_log (
  "id" uuid,
  "related_table" text,
  "related_id" uuid,
  "to_email" text,
  "subject" text,
  "body" text,
  "status" text,
  "error" text,
  "provider_id" text,
  "sent_by" uuid,
  "created_at" timestamptz
);
CREATE TABLE public.google_integrations (
  "id" uuid,
  "sheet_url" text,
  "spreadsheet_id" text,
  "sheet_name" text,
  "header_row" int4,
  "auto_sync_enabled" bool,
  "sync_frequency_minutes" int4,
  "last_sync" timestamptz,
  "last_synced_row" int4,
  "google_account_email" text,
  "connection_status" text,
  "column_mapping" jsonb,
  "last_error" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "user_id" uuid,
  "mapping" jsonb,
  PRIMARY KEY("id")
);
CREATE TABLE public.integrations (
  "id" uuid,
  "module" text,
  "sheet_url" text,
  "spreadsheet_id" text,
  "sheet_name" text,
  "header_row" int4,
  "column_mapping" jsonb,
  "auto_sync" bool,
  "last_sync_at" timestamptz,
  "last_synced_row" int4,
  "last_status" text,
  "last_error" text,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
CREATE TABLE public.interviews (
  "id" uuid,
  "candidate_id" uuid,
  "client_id" uuid,
  "round" text,
  "interview_date" date,
  "interview_time" time,
  "mode" text,
  "feedback" text,
  "status" text,
  "created_by" uuid,
  "created_at" timestamptz,
  "candidate_uuid" uuid,
  "client_uuid" uuid,
  "submission_uuid" uuid,
  "scheduling_token" uuid,
  "proposed_slots" jsonb
);
CREATE TABLE public.job_openings (
  "id" uuid,
  "job_title" text,
  "client_id" uuid,
  "location" text,
  "salary_min" numeric,
  "salary_max" numeric,
  "assigned_recruiter" uuid,
  "open_positions" int4,
  "priority" text,
  "status" text,
  "created_by" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "client_uuid" uuid,
  "requirements" text,
  "description" text,
  "is_confidential" bool
);
CREATE TABLE public.notifications (
  "id" uuid DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "title" text,
  "message" text,
  "type" text,
  "is_read" bool,
  "created_at" timestamptz,
  "related_table" text,
  "related_id" uuid,
  UNIQUE("related_table","related_id","type")
);
CREATE TABLE public.offers (
  "id" uuid,
  "candidate_id" uuid,
  "client_id" uuid,
  "offer_date" date,
  "joining_date" date,
  "salary" numeric,
  "ctc" numeric,
  "offer_status" text,
  "joining_status" text,
  "created_by" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "candidate_uuid" uuid,
  "client_uuid" uuid,
  "submission_uuid" uuid,
  "interview_uuid" uuid
);
CREATE TABLE public.profiles (
  "id" uuid,
  "full_name" text,
  "email" text,
  "phone" text,
  "department" text,
  "role_request" text,
  "status" public.user_status,
  "is_active" bool,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
CREATE TABLE public.submissions (
  "id" uuid,
  "candidate_id" uuid,
  "client_id" uuid,
  "job_id" uuid,
  "role_title" text,
  "submission_date" date,
  "status" text,
  "remarks" text,
  "created_by" uuid,
  "created_at" timestamptz,
  "candidate_uuid" uuid,
  "client_uuid" uuid,
  "job_uuid" uuid
);
CREATE TABLE public.sync_logs (
  "id" uuid,
  "module" text,
  "triggered_by" text,
  "rows_scanned" int4,
  "rows_created" int4,
  "rows_updated" int4,
  "rows_skipped" int4,
  "errors" jsonb,
  "status" text,
  "message" text,
  "created_at" timestamptz
);
CREATE TABLE public.user_roles (
  "id" uuid,
  "user_id" uuid,
  "role" public.app_role,
  "created_at" timestamptz
);
CREATE TABLE public.workflow_rules (
  "id" uuid,
  "name" text,
  "table_name" text,
  "field_name" text,
  "field_value" text,
  "action_type" text,
  "notify_target" text,
  "notify_title" text,
  "notify_message" text,
  "update_field_name" text,
  "update_field_value" text,
  "is_active" bool,
  "created_by" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
CREATE OR REPLACE FUNCTION public.on_candidate_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recruiter_name text;
  v_new_id uuid;
  v_salary numeric;
  v_fee numeric;
  v_gst numeric;
BEGIN
  IF NEW.stage IS NULL OR NEW.stage = OLD.stage THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_recruiter_name FROM public.profiles WHERE id = NEW.assigned_recruiter;

  -- 1. Submitted to client
  IF NEW.stage = 'submitted_to_client' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.submissions
      WHERE candidate_uuid = NEW.id
        AND COALESCE(client_uuid::text,'') = COALESCE((
          SELECT client_uuid::text FROM public.submissions WHERE candidate_uuid = NEW.id LIMIT 1
        ),'')
        AND status = 'submitted'
    ) THEN
      INSERT INTO public.submissions (candidate_uuid, candidate_id, role_title, submission_date, status, remarks, created_by)
      VALUES (NEW.id, NEW.id, NEW.position_applied, CURRENT_DATE, 'submitted',
              COALESCE(NEW.notes,'Auto-created from stage change'), NEW.assigned_recruiter)
      RETURNING id INTO v_new_id;

      INSERT INTO public.candidate_activities (candidate_id, candidate_name, recruiter_id, recruiter_name, action_type, module_created, related_record_id, notes)
      VALUES (NEW.id, NEW.full_name, NEW.assigned_recruiter, v_recruiter_name,
              'stage_change', 'submissions', v_new_id, 'Candidate submitted to client');
    END IF;

  -- 2. Interview scheduled
  ELSIF NEW.stage = 'interview_scheduled' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.interviews
      WHERE candidate_uuid = NEW.id AND status = 'scheduled'
    ) THEN
      INSERT INTO public.interviews (candidate_uuid, candidate_id, round, interview_date, status, mode, created_by)
      VALUES (NEW.id, NEW.id, 'screening', CURRENT_DATE, 'scheduled', 'online', NEW.assigned_recruiter)
      RETURNING id INTO v_new_id;

      INSERT INTO public.candidate_activities (candidate_id, candidate_name, recruiter_id, recruiter_name, action_type, module_created, related_record_id, notes)
      VALUES (NEW.id, NEW.full_name, NEW.assigned_recruiter, v_recruiter_name,
              'stage_change', 'interviews', v_new_id, 'Interview scheduled');
    END IF;

  -- 3. Offer released
  ELSIF NEW.stage = 'offer_released' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.offers
      WHERE candidate_uuid = NEW.id AND offer_status IN ('released','pending','accepted')
    ) THEN
      INSERT INTO public.offers (candidate_uuid, candidate_id, offer_date, offer_status, joining_status, salary, ctc, created_by)
      VALUES (NEW.id, NEW.id, CURRENT_DATE, 'released', 'pending',
              NEW.expected_salary, NEW.expected_salary, NEW.assigned_recruiter)
      RETURNING id INTO v_new_id;

      INSERT INTO public.candidate_activities (candidate_id, candidate_name, recruiter_id, recruiter_name, action_type, module_created, related_record_id, notes)
      VALUES (NEW.id, NEW.full_name, NEW.assigned_recruiter, v_recruiter_name,
              'stage_change', 'offers', v_new_id, 'Offer released');
    END IF;

  -- 4. Joined
  ELSIF NEW.stage = 'joined' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.billing WHERE candidate_uuid = NEW.id
    ) THEN
      v_salary := COALESCE(NEW.expected_salary, NEW.current_salary, 0);
      v_fee := ROUND(v_salary * 0.0833, 2);
      v_gst := ROUND(v_fee * 0.18, 2);

      INSERT INTO public.billing (candidate_uuid, candidate_id, invoice_date, salary, placement_fee, gst, invoice_amount, outstanding_amount, payment_status, created_by)
      VALUES (NEW.id, NEW.id, CURRENT_DATE, v_salary, v_fee, v_gst, v_fee + v_gst, v_fee + v_gst, 'unpaid', NEW.assigned_recruiter)
      RETURNING id INTO v_new_id;

      INSERT INTO public.candidate_activities (candidate_id, candidate_name, recruiter_id, recruiter_name, action_type, module_created, related_record_id, notes)
      VALUES (NEW.id, NEW.full_name, NEW.assigned_recruiter, v_recruiter_name,
              'stage_change', 'billing', v_new_id, 'Candidate joined and billing initiated');
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.candidate_activities (candidate_id, candidate_name, action_type, notes)
  VALUES (NEW.id, NEW.full_name, 'automation_error', SQLERRM);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_workflow_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rule RECORD;
  new_val TEXT;
  old_val TEXT;
  cand_id TEXT;
  client_id TEXT;
  cand_name TEXT;
  client_name TEXT;
  recruiter_id UUID;
  target_user_id UUID;
  title TEXT;
  msg TEXT;
  notif_type TEXT;
  depth INT := COALESCE(NULLIF(current_setting('app.wf_depth', true), '')::int, 0);
BEGIN
  -- Safety valve against a misconfigured pair of rules that could otherwise
  -- retrigger each other forever (rule A: field=1 -> set field=2; rule B:
  -- field=2 -> set field=1). app.wf_depth is transaction-local (set_config's
  -- third argument below is true), so it naturally resets once this
  -- statement's transaction ends and costs nothing on the normal, non-chained
  -- path where depth never leaves 0.
  IF depth >= 5 THEN
    RETURN NEW;
  END IF;

  -- Resolve the candidate/client this row is about, once, for every rule
  -- below to reuse — both for {{full_name}}/{{company_name}} templating and
  -- for the "assigned_recruiter" notify target. Doesn't assume TG_TABLE_NAME
  -- is candidates/clients itself; falls back to the *_uuid / legacy *_id
  -- column (the same duality every other table in this app already has).
  IF TG_TABLE_NAME = 'candidates' THEN
    cand_id := NEW.id::text;
    cand_name := to_jsonb(NEW) ->> 'full_name';
    recruiter_id := (to_jsonb(NEW) ->> 'assigned_recruiter')::uuid;
  ELSE
    cand_id := COALESCE(to_jsonb(NEW) ->> 'candidate_uuid', to_jsonb(NEW) ->> 'candidate_id');
    IF cand_id IS NOT NULL THEN
      SELECT full_name, assigned_recruiter INTO cand_name, recruiter_id
        FROM public.candidates WHERE id = cand_id::uuid;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'clients' THEN
    client_id := NEW.id::text;
    client_name := to_jsonb(NEW) ->> 'company_name';
  ELSE
    client_id := COALESCE(to_jsonb(NEW) ->> 'client_uuid', to_jsonb(NEW) ->> 'client_id');
    IF client_id IS NOT NULL THEN
      SELECT company_name INTO client_name FROM public.clients WHERE id = client_id::uuid;
    END IF;
  END IF;

  FOR rule IN
    SELECT * FROM public.workflow_rules WHERE table_name = TG_TABLE_NAME AND is_active
  LOOP
    new_val := to_jsonb(NEW) ->> rule.field_name;
    old_val := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ->> rule.field_name ELSE NULL END;

    -- Fire only on a genuine transition into the watched value: an INSERT
    -- landing directly on it, or an UPDATE where it just changed to it.
    -- Skipping the case where it was already at that value is what makes
    -- action_type='update_field' safe below — see the WHERE guard there.
    IF new_val IS DISTINCT FROM rule.field_value THEN CONTINUE; END IF;
    IF TG_OP = 'UPDATE' AND old_val IS NOT DISTINCT FROM new_val THEN CONTINUE; END IF;

    title := replace(replace(COALESCE(rule.notify_title, ''), '{{full_name}}', COALESCE(cand_name, '')), '{{company_name}}', COALESCE(client_name, ''));
    msg := replace(replace(replace(COALESCE(rule.notify_message, ''), '{{full_name}}', COALESCE(cand_name, '')), '{{company_name}}', COALESCE(client_name, '')), '{{value}}', COALESCE(new_val, ''));

    -- Every notify insert below ON CONFLICT DO NOTHINGs against
    -- (related_table, related_id, type) — same idempotency pattern as
    -- step 1's generate_reminders(). Net effect: a given rule notifies a
    -- given user about a given record at most once, ever, not once per
    -- transition — so a candidate that goes rejected -> reinstated ->
    -- rejected again only notifies on the first rejection. That's the
    -- deliberately-conservative default (no repeat-notification storms from
    -- flip-flopping data); revisit if a rule genuinely needs to refire on
    -- every occurrence.
    IF rule.action_type = 'notify' THEN
      IF rule.notify_target = 'assigned_recruiter' THEN
        IF recruiter_id IS NOT NULL THEN
          notif_type := 'workflow:' || rule.id::text || ':' || recruiter_id::text;
          INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
          VALUES (recruiter_id, title, msg, notif_type, TG_TABLE_NAME, NEW.id)
          ON CONFLICT (related_table, related_id, type) DO NOTHING;
        END IF;
      ELSIF rule.notify_target LIKE 'role:%' THEN
        -- One row per matching user rather than a single broadcast row,
        -- since notifications has no role column to broadcast-by-role with
        -- — reusing the existing user_id-scoped read policy from step 1
        -- unchanged, at the cost of N rows for N users with that role
        -- (fine at this app's scale).
        FOR target_user_id IN
          SELECT ur.user_id FROM public.user_roles ur WHERE ur.role::text = substring(rule.notify_target FROM 6)
        LOOP
          notif_type := 'workflow:' || rule.id::text || ':' || target_user_id::text;
          INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
          VALUES (target_user_id, title, msg, notif_type, TG_TABLE_NAME, NEW.id)
          ON CONFLICT (related_table, related_id, type) DO NOTHING;
        END LOOP;
      END IF;

    ELSIF rule.action_type = 'update_field' THEN
      -- %I quotes identifiers (table/column names), %L quotes literal values
      -- — the standard, injection-safe way to build dynamic SQL in plpgsql.
      -- The "AND ... IS DISTINCT FROM ..." guard is what actually stops a
      -- runaway loop: it makes the UPDATE affect zero rows once the field is
      -- already at the target value, so the AFTER trigger this statement
      -- would otherwise re-fire simply doesn't run a second time for the
      -- same field. Depth-limiting above is the backstop for a rule that
      -- chains into a *different* field a second rule then chains back.
      PERFORM set_config('app.wf_depth', (depth + 1)::text, true);
      EXECUTE format(
        'UPDATE public.%I SET %I = %L WHERE id = %L AND %I IS DISTINCT FROM %L',
        TG_TABLE_NAME, rule.update_field_name, rule.update_field_value, NEW.id,
        rule.update_field_name, rule.update_field_value
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_assigned_recruiter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- If assigned_recruiter is NULL, set to current user
    IF NEW.assigned_recruiter IS NULL THEN
        NEW.assigned_recruiter := auth.uid();
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_candidate_sync_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.candidate_code IS NULL OR btrim(NEW.candidate_code) = '' THEN
    NEW.candidate_code := 'CAND-' || nextval('public.candidate_code_seq');
  END IF;

  NEW.stage := COALESCE(NEW.stage, 'lead_received'::candidate_stage);
  NEW.status := COALESCE(NULLIF(NEW.status, ''), 'active');

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.sync_google_integration_mapping()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.column_mapping := coalesce(new.column_mapping, '{}'::jsonb);
  new.mapping := coalesce(new.mapping, '{}'::jsonb);

  if tg_op = 'INSERT' then
    if new.mapping = '{}'::jsonb and new.column_mapping <> '{}'::jsonb then
      new.mapping := new.column_mapping;
    elsif new.column_mapping = '{}'::jsonb and new.mapping <> '{}'::jsonb then
      new.column_mapping := new.mapping;
    end if;
  else
    if new.mapping = '{}'::jsonb and new.column_mapping <> '{}'::jsonb then
      new.mapping := new.column_mapping;
    elsif new.column_mapping = '{}'::jsonb and new.mapping <> '{}'::jsonb then
      new.column_mapping := new.mapping;
    elsif new.mapping is distinct from old.mapping and new.column_mapping is not distinct from old.column_mapping then
      new.column_mapping := new.mapping;
    elsif new.column_mapping is distinct from old.column_mapping and new.mapping is not distinct from old.mapping then
      new.mapping := new.column_mapping;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.track_stage_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO candidate_stage_history (
            candidate_id, 
            previous_stage, 
            new_stage, 
            changed_by
        ) VALUES (
            NEW.id, 
            OLD.stage, 
            NEW.stage, 
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$function$;
CREATE TRIGGER candidates_sync_defaults_trigger BEFORE INSERT ON candidates FOR EACH ROW EXECUTE FUNCTION set_candidate_sync_defaults();
CREATE TRIGGER candidates_updated_at_trigger BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_assigned_recruiter_trigger BEFORE INSERT ON candidates FOR EACH ROW EXECUTE FUNCTION set_assigned_recruiter();
CREATE TRIGGER set_candidate_sync_defaults_trigger BEFORE INSERT ON candidates FOR EACH ROW EXECUTE FUNCTION set_candidate_sync_defaults();
CREATE TRIGGER set_google_integrations_updated_at BEFORE UPDATE ON google_integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sync_google_integration_mapping_trigger BEFORE INSERT OR UPDATE ON google_integrations FOR EACH ROW EXECUTE FUNCTION sync_google_integration_mapping();
CREATE TRIGGER track_stage_changes_trigger AFTER UPDATE OF stage ON candidates FOR EACH ROW EXECUTE FUNCTION track_stage_changes();
CREATE TRIGGER trg_candidate_stage_change AFTER UPDATE OF stage ON candidates FOR EACH ROW WHEN (old.stage IS DISTINCT FROM new.stage) EXECUTE FUNCTION on_candidate_stage_change();
CREATE TRIGGER workflow_rules_trigger AFTER INSERT OR UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION run_workflow_rules();

CREATE SCHEMA crm_private;
CREATE TABLE crm_private.candidate_sync_leases(owner_id uuid PRIMARY KEY,lease_token uuid NOT NULL,expires_at timestamptz NOT NULL);
INSERT INTO public.profiles(id,status,is_active,full_name) VALUES('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','approved',true,'Synthetic Admin');
INSERT INTO public.user_roles(user_id,role) VALUES('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin');
INSERT INTO public.google_integrations(id,user_id,last_synced_row,header_row,spreadsheet_id,sheet_name) VALUES('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',1,1,'SYNTHETIC-SOURCE','Applicants');
INSERT INTO crm_private.candidate_sync_leases(owner_id,lease_token,expires_at) VALUES('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',clock_timestamp()+interval '20 minutes');
CREATE SCHEMA IF NOT EXISTS crm_private;
REVOKE ALL ON SCHEMA crm_private FROM PUBLIC,anon,authenticated;
CREATE TABLE crm_private.candidate_sync_row_ledger (
 integration_id uuid NOT NULL REFERENCES public.google_integrations(id),
 row_number integer NOT NULL CHECK (row_number>=2),
 source_key text NOT NULL,
 payload_fingerprint text NOT NULL,
 candidate_id uuid,
 action text NOT NULL CHECK (action IN ('created','updated','skipped')),
 committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(integration_id,row_number)
);
ALTER TABLE crm_private.candidate_sync_row_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.candidate_sync_row_ledger FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.crm_commit_candidate_sync_row(
 p_owner uuid,p_token uuid,p_integration uuid,p_row_number integer,p_candidate jsonb
) RETURNS TABLE(outcome text,candidate_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE
 v_integration record;
 v_prior record;
 v_source text;
 v_fingerprint text;
 v_email text;
 v_mobile text;
 v_name text;
 v_id uuid;
 v_matched_count bigint;
 v_action text;
 v_previous_source text;
BEGIN
 IF p_owner IS NULL OR p_token IS NULL OR p_integration IS NULL OR p_row_number IS NULL
    OR p_row_number<2 OR p_candidate IS NULL OR jsonb_typeof(p_candidate)<>'object' THEN
   RAISE EXCEPTION 'Invalid sync row input' USING ERRCODE='22023';
 END IF;
 IF (p_candidate - ARRAY['full_name','mobile','email','location','position_applied',
 'current_company','experience_years','current_salary','expected_salary',
 'notice_period','resume_url','source','notes','stage','status','created_source']) <> '{}'::jsonb THEN
   RAISE EXCEPTION 'Unsupported candidate keys' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
   WHERE p.id=p_owner AND p.status='approved' AND p.is_active IS TRUE AND r.role='admin'
 ) THEN RAISE EXCEPTION 'Sync owner not an approved administrator' USING ERRCODE='42501'; END IF;
 -- Lock makes a stale worker unable to commit after expiry/takeover.
 PERFORM 1 FROM crm_private.candidate_sync_leases l
 WHERE l.owner_id=p_owner AND l.lease_token=p_token AND l.expires_at>clock_timestamp()
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sync lease expired or not owned' USING ERRCODE='42501'; END IF;
 SELECT i.id,i.last_synced_row,i.header_row,i.spreadsheet_id,i.sheet_name,i.user_id
 INTO v_integration FROM public.google_integrations i
 WHERE i.id=p_integration AND i.user_id=p_owner FOR UPDATE;
 IF NOT FOUND OR v_integration.spreadsheet_id IS NULL OR v_integration.header_row IS NULL
 THEN RAISE EXCEPTION 'Integration owner or sheet missing' USING ERRCODE='42501'; END IF;
 IF p_row_number<=v_integration.header_row THEN
   RAISE EXCEPTION 'Header row cannot be imported' USING ERRCODE='22023';
 END IF;
 v_source:=v_integration.spreadsheet_id||':'||v_integration.sheet_name||':'||v_integration.header_row;
 v_fingerprint:=md5(p_candidate::text);
 SELECT l.source_key,l.payload_fingerprint,l.candidate_id,l.action INTO v_prior
 FROM crm_private.candidate_sync_row_ledger l
 WHERE l.integration_id=p_integration AND l.row_number=p_row_number;
 IF FOUND THEN
   IF v_prior.source_key<>v_source OR v_prior.payload_fingerprint<>v_fingerprint THEN
     RAISE EXCEPTION 'Existing imported row changed; manual review required' USING ERRCODE='23505';
   END IF;
   RETURN QUERY SELECT 'replayed'::text,v_prior.candidate_id;
   RETURN;
 END IF;
 IF v_integration.last_synced_row<>p_row_number-1 THEN
   RAISE EXCEPTION 'Non-contiguous cursor; manual review required' USING ERRCODE='23514';
 END IF;
 -- No silent takeover of old untracked cursors or a changed sheet source.
 IF v_integration.last_synced_row>v_integration.header_row THEN
   SELECT l.source_key INTO v_previous_source FROM crm_private.candidate_sync_row_ledger l
   WHERE l.integration_id=p_integration AND l.row_number=v_integration.last_synced_row;
   IF NOT FOUND OR v_previous_source<>v_source THEN
     RAISE EXCEPTION 'Prior sync cursor/source unverified; manual review required' USING ERRCODE='23514';
   END IF;
 END IF;
 -- Serialize cooperating importers across multiple owners; other manual writes
 -- are NOT protected, so unique-candidate/reconciliation review remains necessary.
 PERFORM pg_advisory_xact_lock(hashtextextended('crm_candidate_sync_importers',0));
 v_email:=nullif(lower(btrim(p_candidate->>'email')),'');
 v_mobile:=nullif(btrim(p_candidate->>'mobile'),'');
 v_name:=coalesce(nullif(btrim(p_candidate->>'full_name'),''),v_email,v_mobile);
 IF length(coalesce(v_name,''))>512 OR length(coalesce(v_email,''))>320 OR length(coalesce(v_mobile,''))>64 THEN
   RAISE EXCEPTION 'Candidate identity too long' USING ERRCODE='22023';
 END IF;
 IF v_name IS NULL THEN
   v_action:='skipped';
   v_id:=NULL;
 ELSE
   SELECT count(*),min(c.id::text)::uuid INTO v_matched_count,v_id
   FROM public.candidates c
   WHERE (v_email IS NOT NULL AND lower(c.email)=v_email)
      OR (v_mobile IS NOT NULL AND c.mobile=v_mobile);
   IF v_matched_count>1 THEN
     RAISE EXCEPTION 'Ambiguous candidate identity; manual review required' USING ERRCODE='23505';
   END IF;
   IF v_id IS NULL THEN
     INSERT INTO public.candidates(
       full_name,mobile,email,location,position_applied,current_company,
       experience_years,current_salary,expected_salary,notice_period,resume_url,
       source,notes,stage,status,created_source
     ) VALUES (
       v_name,v_mobile,v_email,nullif(p_candidate->>'location',''),
       nullif(p_candidate->>'position_applied',''),nullif(p_candidate->>'current_company',''),
       nullif(p_candidate->>'experience_years','')::numeric,
       nullif(p_candidate->>'current_salary','')::numeric,
       nullif(p_candidate->>'expected_salary','')::numeric,
       nullif(p_candidate->>'notice_period',''),nullif(p_candidate->>'resume_url',''),
       coalesce(nullif(p_candidate->>'source',''),'Google Form'),
       nullif(p_candidate->>'notes',''),'lead_received','active','google_form_sync'
     ) RETURNING id INTO v_id;
     INSERT INTO public.notifications(title,message,type,related_table,related_id)
     VALUES('New Candidate Added via Google Form','A candidate was synced from Google Sheets.',
            'success','candidates',v_id)
     ON CONFLICT DO NOTHING;
     v_action:='created';
   ELSE
     UPDATE public.candidates c SET
       full_name=v_name,
       email=coalesce(v_email,c.email),mobile=coalesce(v_mobile,c.mobile),
       location=coalesce(nullif(p_candidate->>'location',''),c.location),
       position_applied=coalesce(nullif(p_candidate->>'position_applied',''),c.position_applied),
       current_company=coalesce(nullif(p_candidate->>'current_company',''),c.current_company),
       experience_years=coalesce(nullif(p_candidate->>'experience_years','')::numeric,c.experience_years),
       current_salary=coalesce(nullif(p_candidate->>'current_salary','')::numeric,c.current_salary),
       expected_salary=coalesce(nullif(p_candidate->>'expected_salary','')::numeric,c.expected_salary),
       notice_period=coalesce(nullif(p_candidate->>'notice_period',''),c.notice_period),
       resume_url=coalesce(nullif(p_candidate->>'resume_url',''),c.resume_url),
       notes=coalesce(nullif(p_candidate->>'notes',''),c.notes)
     WHERE c.id=v_id;
     v_action:='updated';
   END IF;
 END IF;
 INSERT INTO crm_private.candidate_sync_row_ledger(
   integration_id,row_number,source_key,payload_fingerprint,candidate_id,action
 ) VALUES(p_integration,p_row_number,v_source,v_fingerprint,v_id,v_action);
 UPDATE public.google_integrations i
 SET last_synced_row=p_row_number,last_sync=clock_timestamp(),connection_status='success',last_error=NULL
 WHERE i.id=p_integration AND i.last_synced_row=p_row_number-1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sync cursor update conflict' USING ERRCODE='40001'; END IF;
 -- Expiry that occurs while waiting on a database lock aborts the whole row.
 PERFORM 1 FROM crm_private.candidate_sync_leases l
 WHERE l.owner_id=p_owner AND l.lease_token=p_token AND l.expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Sync lease expired during row commit' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT v_action,v_id;
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb)
 TO service_role;

DO $test$ DECLARE z record; c record; n int; BEGIN
 SELECT * INTO z FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',2,'{"full_name":"Synthetic Candidate","email":"example@example.invalid","mobile":"7000000000"}');
 IF z.outcome<>'created' THEN RAISE EXCEPTION 'create failed'; END IF;
 SELECT candidate_code,stage,status,assigned_recruiter INTO c FROM public.candidates WHERE id=z.candidate_id;
 IF c.candidate_code NOT LIKE 'CAND-%' OR c.stage<>'lead_received' OR c.status<>'active' THEN RAISE EXCEPTION 'actual insert triggers did not set defaults'; END IF;
 IF c.assigned_recruiter IS NOT NULL THEN RAISE EXCEPTION 'service-role auth.uid unexpectedly assigned recruiter'; END IF;
 SELECT * INTO z FROM public.crm_commit_candidate_sync_row('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',3,'{"full_name":"Synthetic Candidate","email":"example@example.invalid","mobile":"7000000000","location":"Kolkata"}');
 IF z.outcome<>'updated' THEN RAISE EXCEPTION 'actual trigger update failed'; END IF;
 UPDATE public.candidates SET stage='contacted',updated_at=NULL WHERE id=z.candidate_id;
 SELECT count(*) INTO n FROM public.candidate_stage_history WHERE candidate_id=z.candidate_id AND new_stage='contacted';
 IF n<>1 THEN RAISE EXCEPTION 'stage history trigger expected 1 got %',n; END IF;
 IF (SELECT updated_at FROM public.candidates WHERE id=z.candidate_id) IS NULL THEN RAISE EXCEPTION 'updated_at trigger missing'; END IF;
 IF (SELECT count(*) FROM public.notifications)<>1 THEN RAISE EXCEPTION 'unexpected notification count'; END IF;
 IF (SELECT last_synced_row FROM public.google_integrations WHERE id='44444444-4444-4444-8444-444444444444')<>3 THEN RAISE EXCEPTION 'sync cursor incorrect'; END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: exact production-derived candidate/integration trigger definitions with atomic row RPC and rollback' AS outcome,NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='candidate_sync_row_ledger') AS no_ledger_left;