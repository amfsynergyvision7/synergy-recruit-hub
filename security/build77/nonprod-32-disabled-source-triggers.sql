-- Build77: 16 verified production-sourced application trigger FUNCTION definitions,
-- with 32 application TRIGGERS immediately DISABLED. Dedicated nonproduction ONLY.
-- The email-conditioned auth.users bootstrap trigger is excluded.
-- DO NOT use in production; no Auth users, no fixture seed, no automation is activated.
-- Function execution is revoked for PUBLIC/anon/authenticated/service_role in same migration.
DO $guard$ BEGIN
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r') <> 19 OR
 (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='v') <> 13 OR
 EXISTS (SELECT 1 FROM auth.users) OR
 EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace) OR
 EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal) THEN
 RAISE EXCEPTION 'Build77 refuses unsafe/partially seeded lab'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.normalize_billing_relationships()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_salary numeric;
BEGIN
  NEW.candidate_uuid := COALESCE(NEW.candidate_uuid, NEW.candidate_id);
  NEW.client_uuid := COALESCE(NEW.client_uuid, NEW.client_id);

  IF NEW.offer_uuid IS NOT NULL THEN
    SELECT COALESCE(o.candidate_uuid, o.candidate_id), COALESCE(o.client_uuid, o.client_id), COALESCE(o.salary, o.ctc)
    INTO NEW.candidate_uuid, NEW.client_uuid, v_salary
    FROM public.offers o
    WHERE o.id = NEW.offer_uuid;
    NEW.salary := COALESCE(NEW.salary, v_salary);
  END IF;

  NEW.placement_fee := COALESCE(NEW.placement_fee, ROUND(COALESCE(NEW.salary, 0) * 0.0833, 2));
  NEW.gst := COALESCE(NEW.gst, ROUND(COALESCE(NEW.placement_fee, 0) * 0.18, 2));
  NEW.invoice_amount := COALESCE(NEW.invoice_amount, COALESCE(NEW.placement_fee, 0) + COALESCE(NEW.gst, 0));
  NEW.outstanding_amount := COALESCE(NEW.outstanding_amount, NEW.invoice_amount);

  NEW.candidate_id := COALESCE(NEW.candidate_id, NEW.candidate_uuid);
  NEW.client_id := COALESCE(NEW.client_id, NEW.client_uuid);
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.normalize_interview_relationships()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.candidate_uuid := COALESCE(NEW.candidate_uuid, NEW.candidate_id);
  NEW.client_uuid := COALESCE(NEW.client_uuid, NEW.client_id);

  IF NEW.submission_uuid IS NOT NULL THEN
    SELECT COALESCE(s.candidate_uuid, s.candidate_id), COALESCE(s.client_uuid, s.client_id)
    INTO NEW.candidate_uuid, NEW.client_uuid
    FROM public.submissions s
    WHERE s.id = NEW.submission_uuid;
  END IF;

  IF NEW.submission_uuid IS NULL AND NEW.candidate_uuid IS NOT NULL THEN
    SELECT s.id INTO NEW.submission_uuid
    FROM public.submissions s
    WHERE COALESCE(s.candidate_uuid, s.candidate_id) = NEW.candidate_uuid
      AND (NEW.client_uuid IS NULL OR COALESCE(s.client_uuid, s.client_id) = NEW.client_uuid)
    ORDER BY s.created_at DESC
    LIMIT 1;
  END IF;

  NEW.candidate_id := COALESCE(NEW.candidate_id, NEW.candidate_uuid);
  NEW.client_id := COALESCE(NEW.client_id, NEW.client_uuid);
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.normalize_job_opening_relationships()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.client_uuid := COALESCE(NEW.client_uuid, NEW.client_id);
  NEW.client_id := COALESCE(NEW.client_id, NEW.client_uuid);
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.normalize_offer_relationships()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.candidate_uuid := COALESCE(NEW.candidate_uuid, NEW.candidate_id);
  NEW.client_uuid := COALESCE(NEW.client_uuid, NEW.client_id);

  IF NEW.interview_uuid IS NOT NULL THEN
    SELECT COALESCE(i.candidate_uuid, i.candidate_id), COALESCE(i.client_uuid, i.client_id), i.submission_uuid
    INTO NEW.candidate_uuid, NEW.client_uuid, NEW.submission_uuid
    FROM public.interviews i
    WHERE i.id = NEW.interview_uuid;
  END IF;

  IF NEW.submission_uuid IS NOT NULL AND (NEW.candidate_uuid IS NULL OR NEW.client_uuid IS NULL) THEN
    SELECT COALESCE(s.candidate_uuid, s.candidate_id), COALESCE(s.client_uuid, s.client_id)
    INTO NEW.candidate_uuid, NEW.client_uuid
    FROM public.submissions s
    WHERE s.id = NEW.submission_uuid;
  END IF;

  IF NEW.submission_uuid IS NULL AND NEW.candidate_uuid IS NOT NULL THEN
    SELECT s.id INTO NEW.submission_uuid
    FROM public.submissions s
    WHERE COALESCE(s.candidate_uuid, s.candidate_id) = NEW.candidate_uuid
      AND (NEW.client_uuid IS NULL OR COALESCE(s.client_uuid, s.client_id) = NEW.client_uuid)
    ORDER BY s.created_at DESC
    LIMIT 1;
  END IF;

  NEW.candidate_id := COALESCE(NEW.candidate_id, NEW.candidate_uuid);
  NEW.client_id := COALESCE(NEW.client_id, NEW.client_uuid);
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.normalize_submission_relationships()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.candidate_uuid := COALESCE(NEW.candidate_uuid, NEW.candidate_id);
  NEW.client_uuid := COALESCE(NEW.client_uuid, NEW.client_id);
  NEW.job_uuid := COALESCE(NEW.job_uuid, NEW.job_id);

  IF NEW.job_uuid IS NOT NULL AND NEW.client_uuid IS NULL THEN
    SELECT client_uuid INTO NEW.client_uuid FROM public.job_openings WHERE id = NEW.job_uuid;
  END IF;

  NEW.candidate_id := COALESCE(NEW.candidate_id, NEW.candidate_uuid);
  NEW.client_id := COALESCE(NEW.client_id, NEW.client_uuid);
  NEW.job_id := COALESCE(NEW.job_id, NEW.job_uuid);
  RETURN NEW;
END $function$;
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
CREATE OR REPLACE FUNCTION public.on_interview_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'scheduled' THEN
    UPDATE public.candidates
    SET stage = 'interview_scheduled', updated_at = now()
    WHERE id = NEW.candidate_uuid
      AND stage NOT IN ('selected','offer_released','joined');
  ELSIF NEW.status = 'completed' THEN
    UPDATE public.candidates
    SET stage = 'interview_completed', updated_at = now()
    WHERE id = NEW.candidate_uuid
      AND stage NOT IN ('selected','offer_released','joined');
  ELSIF NEW.status = 'selected' THEN
    UPDATE public.candidates
    SET stage = 'selected', updated_at = now()
    WHERE id = NEW.candidate_uuid;

    INSERT INTO public.offers (
      candidate_uuid, candidate_id, client_uuid, client_id, submission_uuid, interview_uuid,
      offer_status, joining_status, salary, ctc, created_by
    )
    SELECT
      NEW.candidate_uuid, NEW.candidate_uuid, NEW.client_uuid, NEW.client_uuid, NEW.submission_uuid, NEW.id,
      'pending', 'pending', c.expected_salary, c.expected_salary, NEW.created_by
    FROM public.candidates c
    WHERE c.id = NEW.candidate_uuid
      AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE o.interview_uuid = NEW.id);
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.on_offer_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.offer_status = 'released' THEN
    UPDATE public.candidates
    SET stage = 'offer_released', updated_at = now()
    WHERE id = NEW.candidate_uuid;
  END IF;

  IF NEW.joining_status = 'joined' THEN
    UPDATE public.candidates
    SET stage = 'joined', updated_at = now()
    WHERE id = NEW.candidate_uuid;

    INSERT INTO public.billing (
      candidate_uuid, candidate_id, client_uuid, client_id, offer_uuid,
      salary, placement_fee, gst, invoice_amount, outstanding_amount, payment_status, created_by
    )
    SELECT
      NEW.candidate_uuid, NEW.candidate_uuid, NEW.client_uuid, NEW.client_uuid, NEW.id,
      COALESCE(NEW.salary, NEW.ctc),
      ROUND(COALESCE(NEW.salary, NEW.ctc, 0) * 0.0833, 2),
      ROUND(COALESCE(NEW.salary, NEW.ctc, 0) * 0.0833 * 0.18, 2),
      ROUND(COALESCE(NEW.salary, NEW.ctc, 0) * 0.0833 * 1.18, 2),
      ROUND(COALESCE(NEW.salary, NEW.ctc, 0) * 0.0833 * 1.18, 2),
      'unpaid', NEW.created_by
    WHERE NOT EXISTS (SELECT 1 FROM public.billing b WHERE b.offer_uuid = NEW.id);
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.on_submission_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.candidates
  SET stage = 'submitted_to_client', updated_at = now()
  WHERE id = NEW.candidate_uuid;
  RETURN NEW;
END $function$;
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
CREATE OR REPLACE FUNCTION public.set_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || to_char(now(),'YYYY') || '-' || nextval('public.invoice_seq');
  END IF;
  RETURN NEW;
END $function$;
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
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER t_app_settings_u BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."app_settings" DISABLE TRIGGER "t_app_settings_u";
CREATE TRIGGER billing_invoice_number_trigger BEFORE INSERT ON billing FOR EACH ROW EXECUTE FUNCTION set_invoice_number();
ALTER TABLE public."billing" DISABLE TRIGGER "billing_invoice_number_trigger";
CREATE TRIGGER billing_updated_at_trigger BEFORE UPDATE ON billing FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."billing" DISABLE TRIGGER "billing_updated_at_trigger";
CREATE TRIGGER normalize_billing_relationships_trigger BEFORE INSERT OR UPDATE ON billing FOR EACH ROW EXECUTE FUNCTION normalize_billing_relationships();
ALTER TABLE public."billing" DISABLE TRIGGER "normalize_billing_relationships_trigger";
CREATE TRIGGER workflow_rules_trigger AFTER INSERT OR UPDATE ON billing FOR EACH ROW EXECUTE FUNCTION run_workflow_rules();
ALTER TABLE public."billing" DISABLE TRIGGER "workflow_rules_trigger";
CREATE TRIGGER candidates_sync_defaults_trigger BEFORE INSERT ON candidates FOR EACH ROW EXECUTE FUNCTION set_candidate_sync_defaults();
ALTER TABLE public."candidates" DISABLE TRIGGER "candidates_sync_defaults_trigger";
CREATE TRIGGER candidates_updated_at_trigger BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."candidates" DISABLE TRIGGER "candidates_updated_at_trigger";
CREATE TRIGGER set_assigned_recruiter_trigger BEFORE INSERT ON candidates FOR EACH ROW EXECUTE FUNCTION set_assigned_recruiter();
ALTER TABLE public."candidates" DISABLE TRIGGER "set_assigned_recruiter_trigger";
CREATE TRIGGER set_candidate_sync_defaults_trigger BEFORE INSERT ON candidates FOR EACH ROW EXECUTE FUNCTION set_candidate_sync_defaults();
ALTER TABLE public."candidates" DISABLE TRIGGER "set_candidate_sync_defaults_trigger";
CREATE TRIGGER track_stage_changes_trigger AFTER UPDATE OF stage ON candidates FOR EACH ROW EXECUTE FUNCTION track_stage_changes();
ALTER TABLE public."candidates" DISABLE TRIGGER "track_stage_changes_trigger";
CREATE TRIGGER trg_candidate_stage_change AFTER UPDATE OF stage ON candidates FOR EACH ROW WHEN (old.stage IS DISTINCT FROM new.stage) EXECUTE FUNCTION on_candidate_stage_change();
ALTER TABLE public."candidates" DISABLE TRIGGER "trg_candidate_stage_change";
CREATE TRIGGER workflow_rules_trigger AFTER INSERT OR UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION run_workflow_rules();
ALTER TABLE public."candidates" DISABLE TRIGGER "workflow_rules_trigger";
CREATE TRIGGER clients_updated_at_trigger BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."clients" DISABLE TRIGGER "clients_updated_at_trigger";
CREATE TRIGGER t_clients_u BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."clients" DISABLE TRIGGER "t_clients_u";
CREATE TRIGGER workflow_rules_trigger AFTER INSERT OR UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION run_workflow_rules();
ALTER TABLE public."clients" DISABLE TRIGGER "workflow_rules_trigger";
CREATE TRIGGER set_google_integrations_updated_at BEFORE UPDATE ON google_integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."google_integrations" DISABLE TRIGGER "set_google_integrations_updated_at";
CREATE TRIGGER sync_google_integration_mapping_trigger BEFORE INSERT OR UPDATE ON google_integrations FOR EACH ROW EXECUTE FUNCTION sync_google_integration_mapping();
ALTER TABLE public."google_integrations" DISABLE TRIGGER "sync_google_integration_mapping_trigger";
CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."integrations" DISABLE TRIGGER "integrations_updated_at";
CREATE TRIGGER interviews_stage_trigger AFTER INSERT OR UPDATE OF status ON interviews FOR EACH ROW EXECUTE FUNCTION on_interview_change();
ALTER TABLE public."interviews" DISABLE TRIGGER "interviews_stage_trigger";
CREATE TRIGGER normalize_interviews_relationships_trigger BEFORE INSERT OR UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION normalize_interview_relationships();
ALTER TABLE public."interviews" DISABLE TRIGGER "normalize_interviews_relationships_trigger";
CREATE TRIGGER workflow_rules_trigger AFTER INSERT OR UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION run_workflow_rules();
ALTER TABLE public."interviews" DISABLE TRIGGER "workflow_rules_trigger";
CREATE TRIGGER job_openings_updated_at_trigger BEFORE UPDATE ON job_openings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."job_openings" DISABLE TRIGGER "job_openings_updated_at_trigger";
CREATE TRIGGER normalize_job_openings_relationships_trigger BEFORE INSERT OR UPDATE ON job_openings FOR EACH ROW EXECUTE FUNCTION normalize_job_opening_relationships();
ALTER TABLE public."job_openings" DISABLE TRIGGER "normalize_job_openings_relationships_trigger";
CREATE TRIGGER normalize_offers_relationships_trigger BEFORE INSERT OR UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION normalize_offer_relationships();
ALTER TABLE public."offers" DISABLE TRIGGER "normalize_offers_relationships_trigger";
CREATE TRIGGER offers_stage_billing_trigger AFTER INSERT OR UPDATE OF offer_status, joining_status ON offers FOR EACH ROW EXECUTE FUNCTION on_offer_change();
ALTER TABLE public."offers" DISABLE TRIGGER "offers_stage_billing_trigger";
CREATE TRIGGER offers_updated_at_trigger BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."offers" DISABLE TRIGGER "offers_updated_at_trigger";
CREATE TRIGGER workflow_rules_trigger AFTER INSERT OR UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION run_workflow_rules();
ALTER TABLE public."offers" DISABLE TRIGGER "workflow_rules_trigger";
CREATE TRIGGER t_profiles_u BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."profiles" DISABLE TRIGGER "t_profiles_u";
CREATE TRIGGER normalize_submissions_relationships_trigger BEFORE INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION normalize_submission_relationships();
ALTER TABLE public."submissions" DISABLE TRIGGER "normalize_submissions_relationships_trigger";
CREATE TRIGGER submissions_stage_trigger AFTER INSERT ON submissions FOR EACH ROW EXECUTE FUNCTION on_submission_insert();
ALTER TABLE public."submissions" DISABLE TRIGGER "submissions_stage_trigger";
CREATE TRIGGER workflow_rules_trigger AFTER INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION run_workflow_rules();
ALTER TABLE public."submissions" DISABLE TRIGGER "workflow_rules_trigger";
CREATE TRIGGER workflow_rules_set_updated_at BEFORE UPDATE ON workflow_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE public."workflow_rules" DISABLE TRIGGER "workflow_rules_set_updated_at";
DO $gate$ BEGIN
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal) <> 32 THEN RAISE EXCEPTION 'Trigger count mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled <> 'D') THEN RAISE EXCEPTION 'A trigger was not disabled'; END IF;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace) <> 16 THEN RAISE EXCEPTION 'Function count mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND (has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE') OR has_function_privilege('service_role',oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Unexpected exposed function EXECUTE'; END IF;
END $gate$;
-- All trigger functions remain inert until separate authorized test/enable process.
