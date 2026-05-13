-- Add explicit internal UUID relationship columns while preserving existing columns
ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS client_uuid uuid;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS candidate_uuid uuid,
  ADD COLUMN IF NOT EXISTS client_uuid uuid,
  ADD COLUMN IF NOT EXISTS job_uuid uuid;

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS candidate_uuid uuid,
  ADD COLUMN IF NOT EXISTS client_uuid uuid,
  ADD COLUMN IF NOT EXISTS submission_uuid uuid;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS candidate_uuid uuid,
  ADD COLUMN IF NOT EXISTS client_uuid uuid,
  ADD COLUMN IF NOT EXISTS submission_uuid uuid,
  ADD COLUMN IF NOT EXISTS interview_uuid uuid;

ALTER TABLE public.billing
  ADD COLUMN IF NOT EXISTS candidate_uuid uuid,
  ADD COLUMN IF NOT EXISTS client_uuid uuid,
  ADD COLUMN IF NOT EXISTS offer_uuid uuid;

-- Backfill new relationship columns from existing UUID relationship columns
UPDATE public.job_openings SET client_uuid = client_id WHERE client_uuid IS NULL AND client_id IS NOT NULL;
UPDATE public.submissions SET candidate_uuid = candidate_id WHERE candidate_uuid IS NULL AND candidate_id IS NOT NULL;
UPDATE public.submissions SET client_uuid = client_id WHERE client_uuid IS NULL AND client_id IS NOT NULL;
UPDATE public.submissions SET job_uuid = job_id WHERE job_uuid IS NULL AND job_id IS NOT NULL;
UPDATE public.interviews SET candidate_uuid = candidate_id WHERE candidate_uuid IS NULL AND candidate_id IS NOT NULL;
UPDATE public.interviews SET client_uuid = client_id WHERE client_uuid IS NULL AND client_id IS NOT NULL;
UPDATE public.offers SET candidate_uuid = candidate_id WHERE candidate_uuid IS NULL AND candidate_id IS NOT NULL;
UPDATE public.offers SET client_uuid = client_id WHERE client_uuid IS NULL AND client_id IS NOT NULL;
UPDATE public.billing SET candidate_uuid = candidate_id WHERE candidate_uuid IS NULL AND candidate_id IS NOT NULL;
UPDATE public.billing SET client_uuid = client_id WHERE client_uuid IS NULL AND client_id IS NOT NULL;

-- Link downstream records to the nearest matching upstream record when possible
UPDATE public.interviews i
SET submission_uuid = s.id
FROM public.submissions s
WHERE i.submission_uuid IS NULL
  AND COALESCE(i.candidate_uuid, i.candidate_id) = COALESCE(s.candidate_uuid, s.candidate_id)
  AND (i.client_uuid IS NULL OR COALESCE(s.client_uuid, s.client_id) = i.client_uuid);

UPDATE public.offers o
SET interview_uuid = i.id
FROM public.interviews i
WHERE o.interview_uuid IS NULL
  AND COALESCE(o.candidate_uuid, o.candidate_id) = COALESCE(i.candidate_uuid, i.candidate_id)
  AND i.status = 'selected';

UPDATE public.offers o
SET submission_uuid = COALESCE(
  (SELECT i.submission_uuid FROM public.interviews i WHERE i.id = o.interview_uuid LIMIT 1),
  (SELECT s.id FROM public.submissions s
   WHERE COALESCE(s.candidate_uuid, s.candidate_id) = COALESCE(o.candidate_uuid, o.candidate_id)
     AND (o.client_uuid IS NULL OR COALESCE(s.client_uuid, s.client_id) = o.client_uuid)
   ORDER BY s.created_at DESC
   LIMIT 1)
)
WHERE o.submission_uuid IS NULL;

UPDATE public.billing b
SET offer_uuid = o.id
FROM public.offers o
WHERE b.offer_uuid IS NULL
  AND COALESCE(b.candidate_uuid, b.candidate_id) = COALESCE(o.candidate_uuid, o.candidate_id)
  AND o.joining_status = 'joined';

-- Keep relationship fields indexed for fast selectors, dashboards, and automation
CREATE UNIQUE INDEX IF NOT EXISTS candidates_candidate_code_unique_idx
  ON public.candidates (candidate_code)
  WHERE candidate_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_openings_client_uuid_idx ON public.job_openings (client_uuid);
CREATE INDEX IF NOT EXISTS submissions_candidate_uuid_idx ON public.submissions (candidate_uuid);
CREATE INDEX IF NOT EXISTS submissions_client_uuid_idx ON public.submissions (client_uuid);
CREATE INDEX IF NOT EXISTS submissions_job_uuid_idx ON public.submissions (job_uuid);
CREATE INDEX IF NOT EXISTS interviews_candidate_uuid_idx ON public.interviews (candidate_uuid);
CREATE INDEX IF NOT EXISTS interviews_client_uuid_idx ON public.interviews (client_uuid);
CREATE INDEX IF NOT EXISTS interviews_submission_uuid_idx ON public.interviews (submission_uuid);
CREATE INDEX IF NOT EXISTS offers_candidate_uuid_idx ON public.offers (candidate_uuid);
CREATE INDEX IF NOT EXISTS offers_interview_uuid_idx ON public.offers (interview_uuid);
CREATE INDEX IF NOT EXISTS billing_candidate_uuid_idx ON public.billing (candidate_uuid);
CREATE INDEX IF NOT EXISTS billing_offer_uuid_idx ON public.billing (offer_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS offers_one_per_selected_interview_idx
  ON public.offers (interview_uuid)
  WHERE interview_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billing_one_per_offer_idx
  ON public.billing (offer_uuid)
  WHERE offer_uuid IS NOT NULL;

-- Add relationship constraints without touching authentication-owned schemas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_openings_client_uuid_fkey') THEN
    ALTER TABLE public.job_openings ADD CONSTRAINT job_openings_client_uuid_fkey FOREIGN KEY (client_uuid) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_candidate_uuid_fkey') THEN
    ALTER TABLE public.submissions ADD CONSTRAINT submissions_candidate_uuid_fkey FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_client_uuid_fkey') THEN
    ALTER TABLE public.submissions ADD CONSTRAINT submissions_client_uuid_fkey FOREIGN KEY (client_uuid) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_job_uuid_fkey') THEN
    ALTER TABLE public.submissions ADD CONSTRAINT submissions_job_uuid_fkey FOREIGN KEY (job_uuid) REFERENCES public.job_openings(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviews_candidate_uuid_fkey') THEN
    ALTER TABLE public.interviews ADD CONSTRAINT interviews_candidate_uuid_fkey FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviews_client_uuid_fkey') THEN
    ALTER TABLE public.interviews ADD CONSTRAINT interviews_client_uuid_fkey FOREIGN KEY (client_uuid) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviews_submission_uuid_fkey') THEN
    ALTER TABLE public.interviews ADD CONSTRAINT interviews_submission_uuid_fkey FOREIGN KEY (submission_uuid) REFERENCES public.submissions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_candidate_uuid_fkey') THEN
    ALTER TABLE public.offers ADD CONSTRAINT offers_candidate_uuid_fkey FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_client_uuid_fkey') THEN
    ALTER TABLE public.offers ADD CONSTRAINT offers_client_uuid_fkey FOREIGN KEY (client_uuid) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_submission_uuid_fkey') THEN
    ALTER TABLE public.offers ADD CONSTRAINT offers_submission_uuid_fkey FOREIGN KEY (submission_uuid) REFERENCES public.submissions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_interview_uuid_fkey') THEN
    ALTER TABLE public.offers ADD CONSTRAINT offers_interview_uuid_fkey FOREIGN KEY (interview_uuid) REFERENCES public.interviews(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_candidate_uuid_fkey') THEN
    ALTER TABLE public.billing ADD CONSTRAINT billing_candidate_uuid_fkey FOREIGN KEY (candidate_uuid) REFERENCES public.candidates(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_client_uuid_fkey') THEN
    ALTER TABLE public.billing ADD CONSTRAINT billing_client_uuid_fkey FOREIGN KEY (client_uuid) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_offer_uuid_fkey') THEN
    ALTER TABLE public.billing ADD CONSTRAINT billing_offer_uuid_fkey FOREIGN KEY (offer_uuid) REFERENCES public.offers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helper resolvers for import compatibility: display IDs/codes can be mapped to UUIDs safely
CREATE OR REPLACE FUNCTION public.resolve_candidate_uuid(_value text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v uuid;
BEGIN
  IF _value IS NULL OR btrim(_value) = '' THEN
    RETURN NULL;
  END IF;

  IF _value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v FROM public.candidates WHERE id = _value::uuid LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;

  SELECT id INTO v
  FROM public.candidates
  WHERE lower(candidate_code) = lower(btrim(_value))
     OR lower(email) = lower(btrim(_value))
     OR lower(full_name) = lower(btrim(_value))
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_client_uuid(_value text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v uuid;
BEGIN
  IF _value IS NULL OR btrim(_value) = '' THEN
    RETURN NULL;
  END IF;

  IF _value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v FROM public.clients WHERE id = _value::uuid LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;

  SELECT id INTO v
  FROM public.clients
  WHERE lower(company_name) = lower(btrim(_value))
     OR lower(email) = lower(btrim(_value))
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_job_uuid(_value text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v uuid;
BEGIN
  IF _value IS NULL OR btrim(_value) = '' THEN
    RETURN NULL;
  END IF;

  IF _value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v FROM public.job_openings WHERE id = _value::uuid LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;

  SELECT id INTO v
  FROM public.job_openings
  WHERE lower(job_title) = lower(btrim(_value))
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN v;
END $$;

-- Normalize/sync relationship columns and set sensible defaults
CREATE OR REPLACE FUNCTION public.normalize_job_opening_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.client_uuid := COALESCE(NEW.client_uuid, NEW.client_id);
  NEW.client_id := COALESCE(NEW.client_id, NEW.client_uuid);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_submission_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.normalize_interview_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.normalize_offer_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.normalize_billing_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
END $$;

-- Automation functions
CREATE OR REPLACE FUNCTION public.on_candidate_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.stage := COALESCE(NEW.stage, 'lead_received'::candidate_stage);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_submission_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.candidates
  SET stage = 'submitted_to_client', updated_at = now()
  WHERE id = NEW.candidate_uuid;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_interview_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.on_offer_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END $$;

-- Recreate triggers because the previous database had functions but no active triggers
DROP TRIGGER IF EXISTS normalize_job_openings_relationships_trigger ON public.job_openings;
CREATE TRIGGER normalize_job_openings_relationships_trigger
BEFORE INSERT OR UPDATE ON public.job_openings
FOR EACH ROW EXECUTE FUNCTION public.normalize_job_opening_relationships();

DROP TRIGGER IF EXISTS candidate_default_stage_trigger ON public.candidates;
CREATE TRIGGER candidate_default_stage_trigger
BEFORE INSERT ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.on_candidate_insert();

DROP TRIGGER IF EXISTS normalize_submissions_relationships_trigger ON public.submissions;
CREATE TRIGGER normalize_submissions_relationships_trigger
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.normalize_submission_relationships();

DROP TRIGGER IF EXISTS submissions_stage_trigger ON public.submissions;
CREATE TRIGGER submissions_stage_trigger
AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.on_submission_insert();

DROP TRIGGER IF EXISTS normalize_interviews_relationships_trigger ON public.interviews;
CREATE TRIGGER normalize_interviews_relationships_trigger
BEFORE INSERT OR UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.normalize_interview_relationships();

DROP TRIGGER IF EXISTS interviews_stage_trigger ON public.interviews;
CREATE TRIGGER interviews_stage_trigger
AFTER INSERT OR UPDATE OF status ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.on_interview_change();

DROP TRIGGER IF EXISTS normalize_offers_relationships_trigger ON public.offers;
CREATE TRIGGER normalize_offers_relationships_trigger
BEFORE INSERT OR UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.normalize_offer_relationships();

DROP TRIGGER IF EXISTS offers_stage_billing_trigger ON public.offers;
CREATE TRIGGER offers_stage_billing_trigger
AFTER INSERT OR UPDATE OF offer_status, joining_status ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.on_offer_change();

DROP TRIGGER IF EXISTS normalize_billing_relationships_trigger ON public.billing;
CREATE TRIGGER normalize_billing_relationships_trigger
BEFORE INSERT OR UPDATE ON public.billing
FOR EACH ROW EXECUTE FUNCTION public.normalize_billing_relationships();

-- Make updated_at automation active for tables that have the column
DROP TRIGGER IF EXISTS candidates_updated_at_trigger ON public.candidates;
CREATE TRIGGER candidates_updated_at_trigger BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS clients_updated_at_trigger ON public.clients;
CREATE TRIGGER clients_updated_at_trigger BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS job_openings_updated_at_trigger ON public.job_openings;
CREATE TRIGGER job_openings_updated_at_trigger BEFORE UPDATE ON public.job_openings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS offers_updated_at_trigger ON public.offers;
CREATE TRIGGER offers_updated_at_trigger BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS billing_updated_at_trigger ON public.billing;
CREATE TRIGGER billing_updated_at_trigger BEFORE UPDATE ON public.billing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ensure display IDs/invoice numbers are generated for new records
DROP TRIGGER IF EXISTS candidates_code_trigger ON public.candidates;
CREATE TRIGGER candidates_code_trigger BEFORE INSERT ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_candidate_code();
DROP TRIGGER IF EXISTS billing_invoice_number_trigger ON public.billing;
CREATE TRIGGER billing_invoice_number_trigger BEFORE INSERT ON public.billing FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();