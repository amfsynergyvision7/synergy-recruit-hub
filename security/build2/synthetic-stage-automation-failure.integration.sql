-- Disposable PostgreSQL only: contrast existing-style swallowed automation
-- errors against fail-closed transactional behavior. No production function.
CREATE TABLE public.build2_failure_candidates (id int PRIMARY KEY,stage text NOT NULL);
CREATE TABLE public.build2_failure_effects (candidate_id int PRIMARY KEY,kind text NOT NULL);
CREATE TABLE public.build2_failure_audit (candidate_id int,reason text);
INSERT INTO public.build2_failure_candidates VALUES (1,'new'),(2,'new');
CREATE FUNCTION public.build2_swallow_error() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 INSERT INTO public.build2_failure_effects VALUES(NEW.id,'sent');
 RAISE EXCEPTION 'synthetic downstream failure';
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 INSERT INTO public.build2_failure_audit VALUES(NEW.id,SQLERRM);
 RETURN NEW;
END $fn$;
CREATE TRIGGER build2_swallow AFTER UPDATE OF stage ON public.build2_failure_candidates
 FOR EACH ROW WHEN(OLD.stage IS DISTINCT FROM NEW.stage)
 EXECUTE FUNCTION public.build2_swallow_error();
UPDATE public.build2_failure_candidates SET stage='submitted' WHERE id=1;
DO $check$
BEGIN
 IF (SELECT stage FROM public.build2_failure_candidates WHERE id=1)<>'submitted'
 OR EXISTS(SELECT 1 FROM public.build2_failure_effects WHERE candidate_id=1)
 OR NOT EXISTS(SELECT 1 FROM public.build2_failure_audit WHERE candidate_id=1)
 THEN RAISE EXCEPTION 'expected swallowed-error behavior not reproduced'; END IF;
END $check$;
DROP TRIGGER build2_swallow ON public.build2_failure_candidates;
CREATE FUNCTION public.build2_fail_closed() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 INSERT INTO public.build2_failure_effects VALUES(NEW.id,'sent');
 RAISE EXCEPTION 'synthetic downstream failure';
END $fn$;
CREATE TRIGGER build2_strict AFTER UPDATE OF stage ON public.build2_failure_candidates
 FOR EACH ROW WHEN(OLD.stage IS DISTINCT FROM NEW.stage)
 EXECUTE FUNCTION public.build2_fail_closed();
DO $check$
BEGIN
 BEGIN
 UPDATE public.build2_failure_candidates SET stage='submitted' WHERE id=2;
 RAISE EXCEPTION 'expected downstream exception was swallowed';
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM <> 'synthetic downstream failure' THEN RAISE; END IF;
 END;
 IF (SELECT stage FROM public.build2_failure_candidates WHERE id=2)<>'new'
 OR EXISTS(SELECT 1 FROM public.build2_failure_effects WHERE candidate_id=2)
 THEN RAISE EXCEPTION 'strict trigger did not roll back candidate stage and effects'; END IF;
END $check$;
SELECT 'PASS: synthetic swallowed errors leave stage changed; strict errors roll back stage and effects' AS result;
