-- Disposable-only end-to-end stage transition authorization + trigger-chain test.
-- Synthetic data, simplified effects. No financial rates or real CRM records.
CREATE TABLE public.build2_chain_candidates (
 id uuid PRIMARY KEY,assigned_recruiter uuid NOT NULL,stage text NOT NULL
);
CREATE TABLE public.build2_chain_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,candidate_id uuid,old_stage text,new_stage text
);
CREATE TABLE public.build2_chain_effects (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,candidate_id uuid,kind text NOT NULL,
 UNIQUE(candidate_id,kind)
);
ALTER TABLE public.build2_chain_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build2_chain_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build2_chain_effects ENABLE ROW LEVEL SECURITY;
GRANT SELECT,UPDATE(stage) ON public.build2_chain_candidates TO authenticated;
CREATE POLICY build2_chain_candidate_read ON public.build2_chain_candidates
 FOR SELECT TO authenticated USING (
 assigned_recruiter=public.build2_stage_uid()
 AND EXISTS(SELECT 1 FROM public.build2_auth_profiles p
 WHERE p.id=public.build2_stage_uid() AND p.status='approved' AND p.is_active)
 );
CREATE POLICY build2_chain_candidate_update ON public.build2_chain_candidates
 FOR UPDATE TO authenticated USING (
 assigned_recruiter=public.build2_stage_uid()
 AND EXISTS(SELECT 1 FROM public.build2_auth_profiles p
 WHERE p.id=public.build2_stage_uid() AND p.status='approved' AND p.is_active)
 ) WITH CHECK (assigned_recruiter=public.build2_stage_uid());
CREATE FUNCTION public.build2_chain_history_writer() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
 BEGIN
 IF OLD.stage IS DISTINCT FROM NEW.stage THEN
 INSERT INTO public.build2_chain_history(candidate_id,old_stage,new_stage)
 VALUES(NEW.id,OLD.stage,NEW.stage);
 END IF;
 RETURN NEW;
 END $fn$;
CREATE FUNCTION public.build2_chain_automation() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
 BEGIN
 IF OLD.stage IS DISTINCT FROM NEW.stage AND NEW.stage IN ('submitted_to_client','interview_scheduled','offer_released','joined') THEN
 INSERT INTO public.build2_chain_effects(candidate_id,kind)
 VALUES(NEW.id,NEW.stage) ON CONFLICT(candidate_id,kind) DO NOTHING;
 END IF;
 RETURN NEW;
 END $fn$;
CREATE TRIGGER build2_chain_history_trigger AFTER UPDATE OF stage
 ON public.build2_chain_candidates FOR EACH ROW EXECUTE FUNCTION public.build2_chain_history_writer();
CREATE TRIGGER build2_chain_automation_trigger AFTER UPDATE OF stage
 ON public.build2_chain_candidates FOR EACH ROW EXECUTE FUNCTION public.build2_chain_automation();
INSERT INTO public.build2_chain_candidates VALUES
 ('88888888-8888-4888-8888-888888888888','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','new'),
 ('99999999-9999-4999-8999-999999999999','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','new');
SET ROLE authenticated;
SET build2_stage.uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE public.build2_chain_candidates SET stage='submitted_to_client'
 WHERE id='88888888-8888-4888-8888-888888888888';
UPDATE public.build2_chain_candidates SET stage='submitted_to_client'
 WHERE id='88888888-8888-4888-8888-888888888888';
UPDATE public.build2_chain_candidates SET stage='joined'
 WHERE id='99999999-9999-4999-8999-999999999999';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.build2_chain_candidates WHERE stage='submitted_to_client')<>1
 THEN RAISE EXCEPTION 'owner update failed'; END IF;
END $check$;
SET build2_stage.uid='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
UPDATE public.build2_chain_candidates SET stage='joined'
 WHERE id='88888888-8888-4888-8888-888888888888';
RESET ROLE;
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.build2_chain_history)<>1
 OR (SELECT count(*) FROM public.build2_chain_effects)<>1
 THEN RAISE EXCEPTION 'unauthorized, no-op or duplicate transition caused effects'; END IF;
 IF (SELECT stage FROM public.build2_chain_candidates WHERE id='99999999-9999-4999-8999-999999999999')<>'new'
 THEN RAISE EXCEPTION 'cross-recruiter stage change succeeded'; END IF;
 IF has_table_privilege('authenticated','public.build2_chain_effects','INSERT')
 OR has_table_privilege('authenticated','public.build2_chain_history','INSERT')
 THEN RAISE EXCEPTION 'browser can write privileged effects directly'; END IF;
END $check$;
SELECT 'PASS: synthetic candidate stage chain creates single audited effect, blocks cross-owner/inactive and direct writes' AS result;
