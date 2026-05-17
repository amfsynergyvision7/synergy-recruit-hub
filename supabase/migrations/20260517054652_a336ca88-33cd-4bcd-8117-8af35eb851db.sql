
-- Activity timeline table
CREATE TABLE IF NOT EXISTS public.candidate_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  candidate_name text,
  recruiter_id uuid,
  recruiter_name text,
  action_type text NOT NULL,
  module_created text,
  related_record_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_activities_candidate ON public.candidate_activities(candidate_id, created_at DESC);

ALTER TABLE public.candidate_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read activities" ON public.candidate_activities;
CREATE POLICY "read activities" ON public.candidate_activities
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "insert activities" ON public.candidate_activities;
CREATE POLICY "insert activities" ON public.candidate_activities
  FOR INSERT TO authenticated WITH CHECK (true);

-- Stage-change automation
CREATE OR REPLACE FUNCTION public.on_candidate_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.on_candidate_stage_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_candidate_stage_change ON public.candidates;
CREATE TRIGGER trg_candidate_stage_change
AFTER UPDATE OF stage ON public.candidates
FOR EACH ROW
WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
EXECUTE FUNCTION public.on_candidate_stage_change();
