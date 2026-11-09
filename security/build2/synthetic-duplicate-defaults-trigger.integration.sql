-- Disposable-only rehearsal of the two live candidate defaults triggers.
-- Models actual defaulting expressions and verifies both triggers fire.
CREATE SEQUENCE public.build2_defaults_code_seq START 1;
CREATE TABLE public.build2_defaults_candidates(
 id integer PRIMARY KEY,candidate_code text,stage text,status text
);
CREATE TABLE public.build2_defaults_calls (candidate_id integer,trigger_name text);
CREATE FUNCTION public.build2_defaults_fn() RETURNS trigger
 LANGUAGE plpgsql SET search_path=public AS $fn$
BEGIN
 INSERT INTO public.build2_defaults_calls VALUES(NEW.id,TG_NAME);
 IF NEW.candidate_code IS NULL OR btrim(NEW.candidate_code)='' THEN
  NEW.candidate_code := 'CAND-' || nextval('public.build2_defaults_code_seq');
 END IF;
 NEW.stage := COALESCE(NEW.stage,'lead_received');
 NEW.status := COALESCE(NULLIF(NEW.status,''),'active');
 RETURN NEW;
END $fn$;
CREATE TRIGGER candidates_sync_defaults_trigger BEFORE INSERT
 ON public.build2_defaults_candidates FOR EACH ROW EXECUTE FUNCTION public.build2_defaults_fn();
CREATE TRIGGER set_candidate_sync_defaults_trigger BEFORE INSERT
 ON public.build2_defaults_candidates FOR EACH ROW EXECUTE FUNCTION public.build2_defaults_fn();
INSERT INTO public.build2_defaults_candidates(id) VALUES (1);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.build2_defaults_calls WHERE candidate_id=1)<>2
 OR (SELECT candidate_code FROM public.build2_defaults_candidates WHERE id=1)<>'CAND-1'
 OR (SELECT stage FROM public.build2_defaults_candidates WHERE id=1)<>'lead_received'
 OR (SELECT status FROM public.build2_defaults_candidates WHERE id=1)<>'active'
 OR (SELECT last_value FROM public.build2_defaults_code_seq)<>1
 THEN RAISE EXCEPTION 'duplicate trigger behavior not reproduced'; END IF;
END $check$;
DROP TRIGGER set_candidate_sync_defaults_trigger ON public.build2_defaults_candidates;
INSERT INTO public.build2_defaults_candidates(id,candidate_code,stage,status)
 VALUES(2,'EXISTING','screening','active');
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.build2_defaults_calls WHERE candidate_id=2)<>1
 OR (SELECT candidate_code FROM public.build2_defaults_candidates WHERE id=2)<>'EXISTING'
 OR (SELECT stage FROM public.build2_defaults_candidates WHERE id=2)<>'screening'
 OR (SELECT last_value FROM public.build2_defaults_code_seq)<>1
 THEN RAISE EXCEPTION 'single-trigger compatibility rehearsal failed'; END IF;
END $check$;
SELECT 'PASS: duplicate defaults trigger fires twice without double code generation; single-trigger behavior preserved' AS result;
