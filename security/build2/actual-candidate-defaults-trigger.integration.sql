-- Original 20260513114149 trigger migration; synthetic-only candidate fixture.
BEGIN;
CREATE TABLE public.candidates(id integer PRIMARY KEY, status text, marker text);
CREATE FUNCTION public.set_candidate_sync_defaults() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.status := COALESCE(NEW.status,'active'); RETURN NEW; END $$;
-- Existing trigger demonstrates the original DROP/CREATE replacement.
CREATE TRIGGER set_candidate_sync_defaults_trigger BEFORE INSERT ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.set_candidate_sync_defaults();
\ir ../../supabase/migrations/20260513114149_ef9683b0-d887-4e8d-bb05-5daedc4e6004.sql
\ir ../../supabase/migrations/20260513114149_ef9683b0-d887-4e8d-bb05-5daedc4e6004.sql
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.candidates'::regclass
 AND tgname='set_candidate_sync_defaults_trigger' AND NOT tgisinternal)<>1
 THEN RAISE EXCEPTION 'Trigger duplicate or missing'; END IF;
END $$;
INSERT INTO public.candidates(id) VALUES(1);
DO $$
BEGIN
 IF (SELECT status FROM public.candidates WHERE id=1)<>'active'
 THEN RAISE EXCEPTION 'Synthetic trigger did not set default status'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.candidates') IS NOT NULL
 OR to_regprocedure('public.set_candidate_sync_defaults()') IS NOT NULL
 THEN RAISE EXCEPTION 'Synthetic fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: original candidate defaults trigger replayed twice with synthetic rollback' AS result;
