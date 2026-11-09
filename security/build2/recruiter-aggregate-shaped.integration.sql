-- Disposable PostgreSQL only. Synthetic recruiter aggregate reproduces the
-- observed production LEFT JOIN, status='approved', COUNT and GROUP BY pattern.
-- Tests invoker RLS, NOT actual production SQL verbatim.
CREATE TABLE public.build2_agg_profiles(
 id uuid PRIMARY KEY,full_name text,email text,status text,is_active boolean NOT NULL);
CREATE TABLE public.build2_agg_candidates(
 id uuid PRIMARY KEY,assigned_recruiter uuid,stage text,created_at timestamptz);
ALTER TABLE public.build2_agg_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build2_agg_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY build2_agg_profile_self ON public.build2_agg_profiles FOR SELECT
 TO authenticated USING (id=auth.uid() AND status='approved' AND is_active=true);
CREATE POLICY build2_agg_candidate_self ON public.build2_agg_candidates FOR SELECT
 TO authenticated USING (assigned_recruiter=auth.uid());
GRANT SELECT ON public.build2_agg_profiles,public.build2_agg_candidates TO authenticated;
INSERT INTO public.build2_agg_profiles VALUES
 ('11111111-1111-1111-1111-111111111111','Recruiter A','a@example.invalid','approved',true),
 ('33333333-3333-3333-3333-333333333333','Recruiter B','b@example.invalid','approved',true),
 ('44444444-4444-4444-4444-444444444444','Inactive Recruiter','i@example.invalid','approved',false);
INSERT INTO public.build2_agg_candidates VALUES
 ('00000000-0000-0000-0000-000000000101','11111111-1111-1111-1111-111111111111','joined',now()),
 ('00000000-0000-0000-0000-000000000102','33333333-3333-3333-3333-333333333333','joined',now()),
 ('00000000-0000-0000-0000-000000000103','44444444-4444-4444-4444-444444444444','joined',now());
CREATE VIEW public.build2_agg_recruiter_report WITH (security_invoker=true) AS
 SELECT p.id AS recruiter_id,p.full_name,count(c.id) AS total_candidates,
 count(CASE WHEN c.stage='joined' THEN 1 ELSE NULL::integer END) AS placements
 FROM public.build2_agg_profiles p
 LEFT JOIN public.build2_agg_candidates c ON c.assigned_recruiter=p.id
 WHERE p.status='approved'
 GROUP BY p.id,p.full_name ORDER BY count(c.id) DESC;
GRANT SELECT ON public.build2_agg_recruiter_report TO authenticated;
SET ROLE authenticated;
SET build2.uid='11111111-1111-1111-1111-111111111111';
DO $check$
DECLARE n integer; total bigint;
BEGIN
 SELECT count(*),coalesce(max(total_candidates),0) INTO n,total
 FROM public.build2_agg_recruiter_report;
 IF n<>1 OR total<>1 THEN RAISE EXCEPTION 'A saw wrong recruiter aggregation: %, %',n,total; END IF;
END $check$;
SET build2.uid='33333333-3333-3333-3333-333333333333';
DO $check$
DECLARE n integer; total bigint;
BEGIN
 SELECT count(*),coalesce(max(total_candidates),0) INTO n,total
 FROM public.build2_agg_recruiter_report;
 IF n<>1 OR total<>1 THEN RAISE EXCEPTION 'B saw wrong recruiter aggregation: %, %',n,total; END IF;
END $check$;
SET build2.uid='44444444-4444-4444-4444-444444444444';
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.build2_agg_recruiter_report;
 IF n<>0 THEN RAISE EXCEPTION 'inactive recruiter sees aggregate: %',n; END IF;
END $check$;
RESET build2.uid;
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.build2_agg_recruiter_report;
 IF n<>0 THEN RAISE EXCEPTION 'missing identity sees aggregate: %',n; END IF;
END $check$;
RESET ROLE;
SELECT 'PASS: recruiter aggregate-shaped invoker view isolates A/B and excludes inactive/missing identities' AS result;
