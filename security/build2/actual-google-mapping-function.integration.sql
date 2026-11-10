-- Original migration function on synthetic-only integration table; no real Google data.
BEGIN;
CREATE TABLE public.google_integrations(
 id integer PRIMARY KEY,
 mapping jsonb,
 column_mapping jsonb,
 updated_at timestamptz
);
\ir ../../supabase/migrations/20260513123429_96eb00ba-85cc-4ea0-82f5-f72784d19773.sql
\ir ../../supabase/migrations/20260513123429_96eb00ba-85cc-4ea0-82f5-f72784d19773.sql
CREATE TRIGGER build2_mapping BEFORE INSERT OR UPDATE ON public.google_integrations
FOR EACH ROW EXECUTE FUNCTION public.sync_google_integration_mapping();
INSERT INTO public.google_integrations(id,column_mapping) VALUES (1,'{"source":"drive"}');
DO $$
BEGIN
 IF (SELECT mapping FROM public.google_integrations WHERE id=1)<>'{"source":"drive"}'::jsonb
 THEN RAISE EXCEPTION 'Mapping was not copied on insert'; END IF;
END $$;
UPDATE public.google_integrations SET mapping='{"source":"csv"}' WHERE id=1;
DO $$
BEGIN
 IF (SELECT column_mapping FROM public.google_integrations WHERE id=1)<>'{"source":"csv"}'::jsonb
 THEN RAISE EXCEPTION 'Column mapping was not synchronized on update'; END IF;
 IF (SELECT updated_at FROM public.google_integrations WHERE id=1) IS NULL
 THEN RAISE EXCEPTION 'updated_at was not populated'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.google_integrations') IS NOT NULL
 OR to_regprocedure('public.sync_google_integration_mapping()') IS NOT NULL
 THEN RAISE EXCEPTION 'Mapping function or fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: original mapping function replayed twice and trigger behavior rolled back' AS result;
