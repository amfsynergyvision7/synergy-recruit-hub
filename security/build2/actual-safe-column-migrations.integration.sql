-- Real repository migrations applied to disposable synthetic tables only.
-- Does NOT replay initial schema, financial functions, triggers or pg_cron/pg_net.
BEGIN;
CREATE TABLE public.candidates (id uuid PRIMARY KEY);
CREATE TABLE public.job_openings (id uuid PRIMARY KEY);
\ir ../../supabase/migrations/20260927180000_job_requirements_field.sql
\ir ../../supabase/migrations/20260927200000_candidate_resume_summary.sql
\ir ../../supabase/migrations/20260930100000_candidate_ats_score.sql
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM information_schema.columns
 WHERE table_schema='public' AND
 ((table_name='job_openings' AND column_name='requirements' AND data_type='text')
 OR (table_name='candidates' AND column_name='resume_summary' AND data_type='text')
 OR (table_name='candidates' AND column_name='ats_score' AND data_type='integer')
 OR (table_name='candidates' AND column_name='ats_issues' AND data_type='jsonb')
 OR (table_name='candidates' AND column_name='ats_checked_at' AND data_type='timestamp with time zone'));
 IF n<>5 THEN RAISE EXCEPTION 'Actual migration column contract failed: % of 5',n; END IF;
END $$;
-- Idempotence on synthetic disposable schema.
\ir ../../supabase/migrations/20260927180000_job_requirements_field.sql
\ir ../../supabase/migrations/20260927200000_candidate_resume_summary.sql
\ir ../../supabase/migrations/20260930100000_candidate_ats_score.sql
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.candidates') IS NOT NULL OR to_regclass('public.job_openings') IS NOT NULL THEN
  RAISE EXCEPTION 'Disposable migration transaction rollback left fixture tables';
 END IF;
END $$;
SELECT 'PASS: three actual safe-column migrations replayed twice and rolled back on disposable PostgreSQL' AS result;
