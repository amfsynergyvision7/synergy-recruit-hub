-- Disposable-only dependency test; run after synthetic-stage-history-isolation.integration.sql.
-- A privileged trigger writer must still work while browser writes remain denied.
CREATE TABLE public.build2_stage_event (id uuid PRIMARY KEY, candidate_id uuid NOT NULL, new_stage text NOT NULL);
ALTER TABLE public.build2_stage_event ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.build2_stage_event TO authenticated;
CREATE POLICY build2_stage_event_insert ON public.build2_stage_event
 FOR INSERT TO authenticated WITH CHECK (
 EXISTS (SELECT 1 FROM public.build2_stage_candidates c WHERE c.id=candidate_id)
 );
CREATE FUNCTION public.build2_stage_trigger_writer() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
 BEGIN
 INSERT INTO public.build2_stage_history(id,candidate_id,new_stage,changed_by)
 VALUES ('66666666-6666-4666-8666-666666666666',NEW.candidate_id,NEW.new_stage,
 public.build2_stage_uid());
 RETURN NEW;
 END $fn$;
CREATE TRIGGER build2_stage_event_after_insert
 AFTER INSERT ON public.build2_stage_event FOR EACH ROW
 EXECUTE FUNCTION public.build2_stage_trigger_writer();
SET ROLE authenticated;
SET build2_stage.uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
INSERT INTO public.build2_stage_event(id,candidate_id,new_stage) VALUES
 ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','offered');
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.build2_stage_history)<>2
 THEN RAISE EXCEPTION 'privileged trigger history write failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.build2_stage_history
 WHERE changed_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 AND new_stage='offered') THEN RAISE EXCEPTION 'trigger actor attribution failed'; END IF;
END $check$;
RESET ROLE;
DO $check$
BEGIN
 IF has_table_privilege('authenticated','public.build2_stage_history','INSERT')
 THEN RAISE EXCEPTION 'browser gained direct stage-history write privilege'; END IF;
END $check$;
SELECT 'PASS: privileged stage-history trigger writes while authenticated direct INSERT remains denied' AS result;
