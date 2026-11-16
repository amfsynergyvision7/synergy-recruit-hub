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
