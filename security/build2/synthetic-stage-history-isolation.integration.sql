-- Disposable-only candidate stage-history least privilege design test.
-- Uses exact seven live column names and data types; not live schema or policy.
CREATE TABLE public.build2_stage_candidates (
 id uuid PRIMARY KEY, assigned_recruiter uuid NOT NULL
);
CREATE TABLE public.build2_stage_history (
 id uuid PRIMARY KEY,
 candidate_id uuid,
 previous_stage text,
 new_stage text NOT NULL,
 changed_by uuid,
 notes text,
 created_at timestamptz
);
ALTER TABLE public.build2_stage_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build2_stage_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.build2_stage_candidates TO authenticated;
GRANT SELECT ON public.build2_stage_history TO authenticated;
-- Independently create identity fixture to avoid dependence on other test names.
CREATE TABLE public.build2_auth_profiles (id uuid PRIMARY KEY,status text,is_active boolean);
ALTER TABLE public.build2_auth_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.build2_auth_profiles TO authenticated;
CREATE POLICY build2_auth_self ON public.build2_auth_profiles
 FOR SELECT TO authenticated USING (id=auth.uid());
INSERT INTO public.build2_auth_profiles VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','approved',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','approved',false);
CREATE POLICY build2_stage_candidate_select ON public.build2_stage_candidates
 FOR SELECT TO authenticated USING (
 assigned_recruiter=auth.uid() AND EXISTS (
 SELECT 1 FROM public.build2_auth_profiles p
 WHERE p.id=auth.uid() AND p.status='approved' AND p.is_active=true
 )
 );
CREATE POLICY build2_stage_history_select ON public.build2_stage_history
 FOR SELECT TO authenticated USING (
 candidate_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.build2_stage_candidates c WHERE c.id=candidate_id
 )
 );
-- Never grant direct stage-history INSERT/UPDATE/DELETE to browser identities.
-- Use distinct UUID values; no CRM business data.
INSERT INTO public.build2_stage_candidates(id,assigned_recruiter) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.build2_stage_history(id,candidate_id,new_stage) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','screening'),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','interview'),
 ('55555555-5555-4555-8555-555555555555',NULL,'unknown');
SET ROLE authenticated;
SET test.uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.build2_stage_history)<>1 THEN
 RAISE EXCEPTION 'recruiter A history isolation failed'; END IF;
END $check$;
SET test.uid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.build2_stage_history)<>1 THEN
 RAISE EXCEPTION 'recruiter B history isolation failed'; END IF;
END $check$;
SET test.uid='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
DO $check$
BEGIN
 IF EXISTS (SELECT 1 FROM public.build2_stage_history) THEN
 RAISE EXCEPTION 'inactive profile can read stage history'; END IF;
END $check$;
SET test.uid='';
DO $check$
BEGIN
 IF EXISTS (SELECT 1 FROM public.build2_stage_history) THEN
 RAISE EXCEPTION 'missing identity can read stage history'; END IF;
END $check$;
RESET ROLE;
DO $check$
BEGIN
 IF has_table_privilege('authenticated','public.build2_stage_history','INSERT')
 OR has_table_privilege('authenticated','public.build2_stage_history','UPDATE')
 OR has_table_privilege('authenticated','public.build2_stage_history','DELETE')
 OR has_table_privilege('anon','public.build2_stage_history','SELECT')
 THEN RAISE EXCEPTION 'stage-history direct write or anonymous read privilege leaked'; END IF;
END $check$;
SELECT 'PASS: stage-history RLS isolates assigned candidate, inactive/missing users and denies browser writes' AS result;
