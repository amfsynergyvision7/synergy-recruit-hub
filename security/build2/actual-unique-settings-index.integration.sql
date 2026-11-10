-- Executes original index migration against synthetic-only PostgreSQL table.
BEGIN;
CREATE TABLE public.google_integrations(id uuid PRIMARY KEY);
\ir ../../supabase/migrations/20260513114418_a73bb859-8580-44ae-aa31-0ea0a49fb6cb.sql
\ir ../../supabase/migrations/20260513114418_a73bb859-8580-44ae-aa31-0ea0a49fb6cb.sql
INSERT INTO public.google_integrations(id) VALUES ('00000000-0000-4000-8000-000000000001');
DO $$
BEGIN
 BEGIN
  INSERT INTO public.google_integrations(id) VALUES ('00000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'Unique settings index failed to block second row';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM public.google_integrations) <> 1 THEN
  RAISE EXCEPTION 'Unique settings index allowed multiple settings rows';
 END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.google_integrations') IS NOT NULL THEN
  RAISE EXCEPTION 'Synthetic settings table survived rollback';
 END IF;
END $$;
SELECT 'PASS: original settings index migration, idempotence, uniqueness, rollback' AS result;
