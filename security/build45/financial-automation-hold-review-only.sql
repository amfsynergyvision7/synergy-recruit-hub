-- BUILD45 REVIEW ONLY: explicit financial automation hold, NOT an active migration.
-- Derived from live PostgreSQL function on 11 November 2026 (read-only).
-- CRITICAL: suppresses joined-stage automatic billing; requires independent finance
-- approval and replay/rollback plan before any staging or production application.
BEGIN;
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

  -- 4. Joined: HOLD financial billing automation pending separate approved policy.
  ELSIF NEW.stage = 'joined' THEN
    -- Preserve stage transition but deliberately create NO financial records.
    -- This is a REVIEW-ONLY proposal; DO NOT activate in production without
    -- independent finance, legal, regression and change-management review.
    NULL;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.candidate_activities (candidate_id, candidate_name, action_type, notes)
  VALUES (NEW.id, NEW.full_name, 'automation_error', SQLERRM);
  RETURN NEW;
END;
$function$;
COMMIT;
