-- BUILD105: Source-shaped copy of two LIVE production trigger definitions
-- observed through READ-ONLY pg_get_functiondef on 2026-11-13.
-- Source project wusntntcqgtpgokggdzv, public schema; no live rows used.
-- ATTACHMENTS observed by read-only pg_get_triggerdef:
-- normalize_submissions_relationships_trigger BEFORE INSERT OR UPDATE
-- submissions_stage_trigger AFTER INSERT
-- workflow_rules_trigger AFTER INSERT OR UPDATE
-- Execution restricted to disposable PostgreSQL CI and always ROLLBACK.
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

CREATE TRIGGER normalize_submissions_relationships_trigger
 BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW
 EXECUTE FUNCTION public.normalize_submission_relationships();
CREATE TRIGGER submissions_stage_trigger
 AFTER INSERT ON public.submissions FOR EACH ROW
 EXECUTE FUNCTION public.on_submission_insert();
CREATE TRIGGER workflow_rules_trigger
 AFTER INSERT OR UPDATE ON public.submissions FOR EACH ROW
 EXECUTE FUNCTION public.run_workflow_rules();
