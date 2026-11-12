-- Build56 exact live-trigger source forensic reproduction, PG17 synthetic only.
-- Neither actual candidate records nor real invoice tables are accessed here.
-- Single BEGIN/ROLLBACK. Source definitions read-only from production 2026-11-12.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
SET LOCAL statement_timeout='35s';
CREATE TYPE public.candidate_stage AS ENUM('lead_received','contacted','interested','resume_collected','submitted_to_client','interview_scheduled','interview_completed','selected','offer_released','joined','rejected','dropped');
CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text);
CREATE TABLE public.candidates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 stage public.candidate_stage NOT NULL DEFAULT 'lead_received',
 assigned_recruiter uuid,full_name text,position_applied text,notes text,
 expected_salary numeric,current_salary numeric);
CREATE TABLE public.offers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_uuid uuid,candidate_id uuid,client_uuid uuid,client_id uuid,
 offer_status text,joining_status text,salary numeric,ctc numeric,created_by uuid);
CREATE TABLE public.billing(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_uuid uuid,candidate_id uuid,client_uuid uuid,client_id uuid,
 offer_uuid uuid,invoice_date date,salary numeric,placement_fee numeric,gst numeric,
 invoice_amount numeric,outstanding_amount numeric,payment_status text,created_by uuid);
CREATE TABLE public.candidate_activities(candidate_id uuid,candidate_name text,
 recruiter_id uuid,recruiter_name text,action_type text,module_created text,
 related_record_id uuid,notes text);
CREATE TABLE public.submissions(id uuid DEFAULT gen_random_uuid(),candidate_uuid uuid,
 candidate_id uuid,client_uuid uuid,role_title text,submission_date date,
 status text,remarks text,created_by uuid);
CREATE TABLE public.interviews(id uuid DEFAULT gen_random_uuid(),candidate_uuid uuid,
 candidate_id uuid,round text,interview_date date,status text,mode text,created_by uuid);
-- Exact source-derived legacy handler function definitions (unmodified body):

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
$function$


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
END $function$

CREATE TRIGGER trg_candidate_stage_change AFTER UPDATE OF stage
 ON public.candidates FOR EACH ROW
 WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
 EXECUTE FUNCTION public.on_candidate_stage_change();
CREATE TRIGGER offers_stage_billing_trigger AFTER INSERT OR UPDATE OF offer_status,joining_status
 ON public.offers FOR EACH ROW EXECUTE FUNCTION public.on_offer_change();

DO $b56_legacy_double_billing$
DECLARE n int; candidate_only int; offer_linked int;
BEGIN
 INSERT INTO public.candidates(id,stage,full_name,expected_salary,current_salary)
 VALUES('11111111-1111-4111-8111-111111111111','lead_received','SYNTHETIC ONLY',100000,90000);
 INSERT INTO public.offers(id,candidate_uuid,candidate_id,offer_status,joining_status,salary,ctc)
 VALUES('22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',
 '11111111-1111-4111-8111-111111111111','pending','pending',100000,100000);
 UPDATE public.offers SET joining_status='joined'
 WHERE id='22222222-2222-4222-8222-222222222222';
 SELECT count(*) INTO n FROM public.billing
 WHERE candidate_uuid='11111111-1111-4111-8111-111111111111';
 SELECT count(*) INTO candidate_only FROM public.billing
 WHERE candidate_uuid='11111111-1111-4111-8111-111111111111' AND offer_uuid IS NULL;
 SELECT count(*) INTO offer_linked FROM public.billing
 WHERE offer_uuid='22222222-2222-4222-8222-222222222222';
 IF n<>2 OR candidate_only<>1 OR offer_linked<>1 THEN
  RAISE EXCEPTION 'Expected exactly TWO invoices from one synthetic joined offer; observed % / % / %',n,candidate_only,offer_linked;
 END IF;
END $b56_legacy_double_billing$;

-- Source-derived BEFORE guard installed after historic vulnerability reproduction.
-- Build56 REVIEW ONLY. No staging/production deployment authorization.
-- Source-derived live financial trigger MD5 4185f4991651dfabc801b631939a7170
-- on_candidate_stage_change and on_offer_change both bill after joined;
-- offer changes also update candidate.stage and can trigger BOTH paths.
-- This BEFORE-trigger proposal blocks the CAUSE rather than a billing INSERT:
-- legacy on_candidate_stage_change catches exceptions and might otherwise
-- return success with stage=joined, so blocking billing AFTER stage is unsafe.
-- No application flag or caller GUC bypass. Pending finance/legal signoff.
CREATE OR REPLACE FUNCTION public.crm_hold_unapproved_joined_transitions()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public
AS $fin56$
BEGIN
 IF TG_TABLE_SCHEMA <> 'public' THEN
   RAISE EXCEPTION 'Unexpected financial transition trigger schema' USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='candidates' THEN
   IF TG_OP='INSERT' THEN
     IF NEW.stage::text='joined' THEN
       RAISE EXCEPTION 'Joined candidate creation requires independent financial approval'
         USING ERRCODE='42501';
     END IF;
   ELSIF TG_OP='UPDATE' THEN
     IF (NEW.stage::text='joined' AND OLD.stage IS DISTINCT FROM NEW.stage)
       OR (OLD.stage::text='joined' AND OLD.stage IS DISTINCT FROM NEW.stage) THEN
       RAISE EXCEPTION 'Candidate joined-stage transition/reversal is on financial HOLD'
         USING ERRCODE='42501';
     END IF;
   ELSE
     RAISE EXCEPTION 'Unsupported candidate financial transition operation'
       USING ERRCODE='42501';
   END IF;
 ELSIF TG_TABLE_NAME='offers' THEN
   -- A legacy offer AFTER UPDATE OF joining_status,offer_status trigger runs
   -- even when a status is assigned to its existing value. Checking merely
   -- OLD vs NEW is insufficient: a joined offer UPDATE could run billing
   -- again. Reject ANY status-column UPDATE while NEW.joining_status=joined.
   IF NEW.joining_status='joined' THEN
     RAISE EXCEPTION 'Joined offer status write is on financial HOLD'
       USING ERRCODE='42501';
   END IF;
   IF TG_OP='UPDATE' AND OLD.joining_status='joined'
       AND OLD.joining_status IS DISTINCT FROM NEW.joining_status THEN
     RAISE EXCEPTION 'Joined offer reversal is on financial HOLD'
       USING ERRCODE='42501';
   END IF;
 ELSE
   RAISE EXCEPTION 'Financial transition guard attached to unexpected table'
     USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $fin56$;
REVOKE ALL ON FUNCTION public.crm_hold_unapproved_joined_transitions()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_crm_hold_joined_candidate
 BEFORE INSERT OR UPDATE OF stage ON public.candidates
 FOR EACH ROW EXECUTE FUNCTION public.crm_hold_unapproved_joined_transitions();
CREATE TRIGGER zz_crm_hold_joined_offer
 BEFORE INSERT OR UPDATE OF joining_status,offer_status ON public.offers
 FOR EACH ROW EXECUTE FUNCTION public.crm_hold_unapproved_joined_transitions();

DO $b56_guard_assertions$
DECLARE n int;
BEGIN
 INSERT INTO public.candidates(id,stage,full_name,expected_salary)
 VALUES('33333333-3333-4333-8333-333333333333','lead_received','SYNTHETIC SECOND',60000);
 INSERT INTO public.offers(id,candidate_uuid,candidate_id,offer_status,joining_status,salary)
 VALUES('44444444-4444-4444-8444-444444444444',
 '33333333-3333-4333-8333-333333333333',
 '33333333-3333-4333-8333-333333333333','pending','pending',60000);
 BEGIN
  UPDATE public.candidates SET stage='joined' WHERE id='33333333-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'Candidate joined update not denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.candidates(id,stage,full_name)
  VALUES('55555555-5555-4555-8555-555555555555','joined','SYNTHETIC BLOCKED');
  RAISE EXCEPTION 'Candidate joined insert not denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.offers SET joining_status='joined' WHERE id='44444444-4444-4444-8444-444444444444';
  RAISE EXCEPTION 'Offer joined update not denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.offers(id,candidate_uuid,joining_status,offer_status)
  VALUES('66666666-6666-4666-8666-666666666666',
  '33333333-3333-4333-8333-333333333333','joined','released');
  RAISE EXCEPTION 'Offer joined insert not denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.offers SET offer_status='released' WHERE id='22222222-2222-4222-8222-222222222222';
  RAISE EXCEPTION 'Already joined offer status update not denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.candidates SET stage='rejected' WHERE id='11111111-1111-4111-8111-111111111111';
  RAISE EXCEPTION 'Joined candidate reversal not denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.candidates
  WHERE id='33333333-3333-4333-8333-333333333333' AND stage='joined')
 OR EXISTS(SELECT 1 FROM public.offers
  WHERE id='44444444-4444-4444-8444-444444444444' AND joining_status='joined')
 THEN RAISE EXCEPTION 'Denied joined transition persisted'; END IF;
 SELECT count(*) INTO n FROM public.billing;
 IF n<>2 THEN RAISE EXCEPTION 'Financial hold changed billing table count: %',n; END IF;
 UPDATE public.candidates SET stage='contacted' WHERE id='33333333-3333-4333-8333-333333333333';
 UPDATE public.offers SET offer_status='released' WHERE id='44444444-4444-4444-8444-444444444444';
 IF NOT EXISTS(SELECT 1 FROM public.candidates
  WHERE id='33333333-3333-4333-8333-333333333333' AND stage='offer_released')
 THEN RAISE EXCEPTION 'Safe offer release was inadvertently blocked'; END IF;
 IF (SELECT count(*) FROM public.billing)<>2
 THEN RAISE EXCEPTION 'Safe offer release triggered new billing'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgname IN
 ('zz_crm_hold_joined_candidate','zz_crm_hold_joined_offer') AND tgenabled='O')<>2
 THEN RAISE EXCEPTION 'Financial HOLD triggers disabled'; END IF;
END $b56_guard_assertions$;
ROLLBACK;
SELECT 'PASS Build56: exact live source produced TWO synthetic invoices BEFORE guard, then blocked joined entry/reversal with NO new billing and full ROLLBACK' AS outcome;
