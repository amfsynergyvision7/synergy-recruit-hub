CREATE SEQUENCE IF NOT EXISTS public.candidate_code_seq START 1001;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_source text;

UPDATE public.candidates
SET status = COALESCE(NULLIF(status, ''), 'active')
WHERE status IS NULL OR status = '';

CREATE OR REPLACE FUNCTION public.set_candidate_sync_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.candidate_code IS NULL OR btrim(NEW.candidate_code) = '' THEN
    NEW.candidate_code := 'CAND-' || nextval('public.candidate_code_seq');
  END IF;

  NEW.stage := COALESCE(NEW.stage, 'lead_received'::candidate_stage);
  NEW.status := COALESCE(NULLIF(NEW.status, ''), 'active');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidates_code_trigger ON public.candidates;
DROP TRIGGER IF EXISTS candidate_default_stage_trigger ON public.candidates;
DROP TRIGGER IF EXISTS candidates_sync_defaults_trigger ON public.candidates;
CREATE TRIGGER candidates_sync_defaults_trigger
BEFORE INSERT ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.set_candidate_sync_defaults();

DROP TRIGGER IF EXISTS candidates_updated_at_trigger ON public.candidates;
CREATE TRIGGER candidates_updated_at_trigger
BEFORE UPDATE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS integrations_updated_at ON public.integrations;
CREATE TRIGGER integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_candidates_sync_mobile ON public.candidates (mobile) WHERE mobile IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_sync_email_lower ON public.candidates (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_created_source ON public.candidates (created_source);