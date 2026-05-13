-- Remove older duplicate triggers now replaced by the normalized pipeline triggers
DROP TRIGGER IF EXISTS t_billing_u ON public.billing;
DROP TRIGGER IF EXISTS trg_invoice_no ON public.billing;
DROP TRIGGER IF EXISTS t_candidates_u ON public.candidates;
DROP TRIGGER IF EXISTS trg_candidate_code ON public.candidates;
DROP TRIGGER IF EXISTS trg_interview_ins ON public.interviews;
DROP TRIGGER IF EXISTS trg_interview_upd ON public.interviews;
DROP TRIGGER IF EXISTS t_jobs_u ON public.job_openings;
DROP TRIGGER IF EXISTS t_offers_u ON public.offers;
DROP TRIGGER IF EXISTS trg_offer_ins ON public.offers;
DROP TRIGGER IF EXISTS trg_offer_upd ON public.offers;
DROP TRIGGER IF EXISTS trg_submission_insert ON public.submissions;

-- Ensure existing shared trigger functions also use a fixed search path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_candidate_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.candidate_code IS NULL THEN
    NEW.candidate_code := 'CAND-' || nextval('public.candidate_code_seq');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || to_char(now(),'YYYY') || '-' || nextval('public.invoice_seq');
  END IF;
  RETURN NEW;
END $$;

-- Trigger-only automation functions should not be directly callable from the public API surface
REVOKE ALL ON FUNCTION public.on_submission_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_interview_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_offer_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_job_opening_relationships() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_submission_relationships() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_interview_relationships() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_offer_relationships() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_billing_relationships() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_candidate_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_candidate_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_invoice_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_candidate_uuid(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_client_uuid(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_job_uuid(text) FROM PUBLIC, anon, authenticated;