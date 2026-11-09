-- ISOLATED TEST FIXTURE ONLY. Synthetic records; never execute on production.
-- Run in disposable PostgreSQL 17 with psql -v ON_ERROR_STOP=1 -f this_file.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('test.uid',true),'')::uuid $$;
CREATE TABLE public.build2_synthetic_candidates (
 id uuid PRIMARY KEY,
 assigned_recruiter uuid NOT NULL,
 full_name text NOT NULL
);
INSERT INTO public.build2_synthetic_candidates VALUES
 ('00000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Synthetic A'),
 ('00000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','Synthetic B');
ALTER TABLE public.build2_synthetic_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY build2_owner_read ON public.build2_synthetic_candidates FOR SELECT TO authenticated
 USING (assigned_recruiter=auth.uid());
CREATE POLICY build2_owner_update ON public.build2_synthetic_candidates FOR UPDATE TO authenticated
 USING (assigned_recruiter=auth.uid()) WITH CHECK (assigned_recruiter=auth.uid());
CREATE VIEW public.build2_synthetic_view WITH (security_invoker=true) AS
 SELECT id,full_name FROM public.build2_synthetic_candidates;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT ON public.build2_synthetic_candidates,public.build2_synthetic_view TO authenticated;
GRANT UPDATE (full_name) ON public.build2_synthetic_candidates TO authenticated;
REVOKE ALL ON public.build2_synthetic_candidates,public.build2_synthetic_view FROM anon;
COMMIT;
-- Validate grant denial without trying to access real records.
DO $$
BEGIN
 IF has_table_privilege('anon','public.build2_synthetic_view','SELECT')
 THEN RAISE EXCEPTION 'anon must not SELECT synthetic view'; END IF;
END $$;
-- Verify column-level protection: a recruiter may update the name but cannot
-- reassign a candidate by mutating the ownership field.
DO $$
BEGIN
 IF has_column_privilege('authenticated','public.build2_synthetic_candidates','assigned_recruiter','UPDATE')
 THEN RAISE EXCEPTION 'recruiter must not update ownership column'; END IF;
 IF NOT has_column_privilege('authenticated','public.build2_synthetic_candidates','full_name','UPDATE')
 THEN RAISE EXCEPTION 'recruiter should update permitted field'; END IF;
 IF has_function_privilege('anon','auth.uid()','EXECUTE')
 THEN RAISE EXCEPTION 'anon must not execute synthetic auth helper'; END IF;
END $$;
SET ROLE authenticated;
SET test.uid='11111111-1111-1111-1111-111111111111';
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.build2_synthetic_view;
 IF n<>1 THEN RAISE EXCEPTION 'recruiter A expected 1 row, saw %',n; END IF;
 IF EXISTS (SELECT 1 FROM public.build2_synthetic_view WHERE full_name='Synthetic B')
 THEN RAISE EXCEPTION 'cross-recruiter view leakage'; END IF;
END $$;
UPDATE public.build2_synthetic_candidates SET full_name='Synthetic A Updated'
 WHERE id='00000000-0000-0000-0000-000000000001';
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.build2_synthetic_view WHERE full_name='Synthetic A Updated')
 THEN RAISE EXCEPTION 'permitted recruiter update failed'; END IF;
END $$;
SET test.uid='22222222-2222-2222-2222-222222222222';
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.build2_synthetic_view;
 IF n<>1 THEN RAISE EXCEPTION 'recruiter B expected 1 row, saw %',n; END IF;
 IF EXISTS (SELECT 1 FROM public.build2_synthetic_view WHERE full_name='Synthetic A')
 THEN RAISE EXCEPTION 'cross-recruiter view leakage'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: synthetic security-invoker view and column grants respect recruiter RLS' AS result;
