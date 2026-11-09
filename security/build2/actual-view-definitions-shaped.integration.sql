-- Disposable PostgreSQL only: actual three production view definitions observed
-- from read-only pg_get_viewdef metadata on 2026-11-10, adapted with explicit
-- public qualifiers and reduced synthetic source columns. Not production DDL.
CREATE TYPE public.build2_candidate_stage AS ENUM ('new','screening');
CREATE TYPE public.build2_user_status AS ENUM ('approved','pending');
CREATE TABLE public.build2_actual_candidates(
 id uuid PRIMARY KEY,candidate_code text,full_name text,location text,
 position_applied text,experience_years numeric,status text,
 stage public.build2_candidate_stage,assigned_recruiter uuid,created_at timestamptz
);
CREATE TABLE public.build2_actual_billing(
 id uuid PRIMARY KEY,invoice_number text,candidate_id uuid,client_id uuid,
 salary numeric,placement_fee numeric,gst numeric,invoice_amount numeric,
 payment_status text,outstanding_amount numeric,invoice_date date,
 created_by uuid,created_at timestamptz,updated_at timestamptz,
 candidate_uuid uuid,client_uuid uuid,offer_uuid uuid
);
CREATE TABLE public.build2_actual_profiles(
 id uuid PRIMARY KEY,full_name text,email text,status public.build2_user_status,
 is_active boolean NOT NULL
);
ALTER TABLE public.build2_actual_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build2_actual_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build2_actual_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.build2_actual_candidates,public.build2_actual_billing,
 public.build2_actual_profiles TO authenticated;
CREATE POLICY build2_candidate_owner ON public.build2_actual_candidates FOR SELECT
 TO authenticated USING (assigned_recruiter=auth.uid());
CREATE POLICY build2_billing_none ON public.build2_actual_billing FOR SELECT
 TO authenticated USING (false);
CREATE POLICY build2_profiles_active ON public.build2_actual_profiles FOR SELECT
 TO authenticated USING (is_active=true);
INSERT INTO public.build2_actual_candidates(id,full_name,assigned_recruiter) VALUES
 ('00000000-0000-0000-0000-000000000011','Recruiter A Candidate','11111111-1111-1111-1111-111111111111'),
 ('00000000-0000-0000-0000-000000000012','Recruiter B Candidate','33333333-3333-3333-3333-333333333333');
INSERT INTO public.build2_actual_billing(id,invoice_number) VALUES
 ('00000000-0000-0000-0000-000000000021','SYNTHETIC-ONLY');
INSERT INTO public.build2_actual_profiles(id,full_name,email,status,is_active) VALUES
 ('00000000-0000-0000-0000-000000000031','Active Approved','a@example.invalid','approved',true),
 ('00000000-0000-0000-0000-000000000032','Inactive Approved','b@example.invalid','approved',false);
-- Columns, projections and ordering match observed pg_get_viewdef output.
CREATE VIEW public.build2_actual_candidate_view WITH (security_invoker=true) AS
 SELECT id,candidate_code,full_name,location,position_applied,experience_years,
 status,stage,assigned_recruiter,created_at FROM public.build2_actual_candidates;
CREATE VIEW public.build2_actual_billing_view WITH (security_invoker=true) AS
 SELECT id,invoice_number,candidate_id,client_id,salary,placement_fee,gst,
 invoice_amount,payment_status,outstanding_amount,invoice_date,created_by,
 created_at,updated_at,candidate_uuid,client_uuid,offer_uuid
 FROM public.build2_actual_billing;
-- Original available_recruiters predicate is status='approved', not is_active.
-- RLS provides additional active filtering here, but do not assume production
-- has the same profile RLS policy or that a privileged view always honors it.
CREATE VIEW public.build2_actual_available_recruiters WITH (security_invoker=true) AS
 SELECT id,full_name,email,'Available'::text AS status
 FROM public.build2_actual_profiles WHERE status='approved'::public.build2_user_status
 ORDER BY full_name;
GRANT SELECT ON public.build2_actual_candidate_view,
 public.build2_actual_billing_view,public.build2_actual_available_recruiters
 TO authenticated;
SET ROLE authenticated;
SET build2.uid='11111111-1111-1111-1111-111111111111';
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.build2_actual_candidate_view;
 IF n<>1 THEN RAISE EXCEPTION 'actual candidate projection bypassed recruiter isolation: %',n; END IF;
 SELECT count(*) INTO n FROM public.build2_actual_billing_view;
 IF n<>0 THEN RAISE EXCEPTION 'actual billing projection exposed financial data: %',n; END IF;
 SELECT count(*) INTO n FROM public.build2_actual_available_recruiters;
 IF n<>1 THEN RAISE EXCEPTION 'approved but inactive profile leaked via invoker view: %',n; END IF;
END $check$;
RESET ROLE;
SELECT 'PASS: three actual-definition-shaped invoker views enforce synthetic recruiter, finance and active-profile RLS' AS result;
