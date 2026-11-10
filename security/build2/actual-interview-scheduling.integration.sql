-- Original interview scheduling migration against disposable synthetic-only table.
BEGIN;
CREATE TABLE public.interviews(id uuid PRIMARY KEY);
\ir ../../supabase/migrations/20260930050000_interview_scheduling_links.sql
\ir ../../supabase/migrations/20260930050000_interview_scheduling_links.sql
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM information_schema.columns
 WHERE table_schema='public' AND table_name='interviews'
 AND ((column_name='scheduling_token' AND data_type='uuid')
   OR (column_name='proposed_slots' AND data_type='jsonb'));
 IF n<>2 THEN RAISE EXCEPTION 'Scheduling migration expected two columns; found %',n; END IF;
END $$;
INSERT INTO public.interviews(id,scheduling_token) VALUES
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011');
DO $$
BEGIN
 BEGIN
  INSERT INTO public.interviews(id,scheduling_token) VALUES
  ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000011');
  RAISE EXCEPTION 'Scheduling token uniqueness was not enforced';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
END $$;
INSERT INTO public.interviews(id,scheduling_token) VALUES
('00000000-0000-4000-8000-000000000003',NULL),
('00000000-0000-4000-8000-000000000004',NULL);
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.interviews') IS NOT NULL THEN RAISE EXCEPTION 'Scheduling fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: original scheduling migration twice, token uniqueness, nullable tokens, rollback' AS result;
