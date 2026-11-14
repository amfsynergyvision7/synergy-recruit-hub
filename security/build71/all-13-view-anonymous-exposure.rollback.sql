-- Build71 DISPOSABLE PostgreSQL 17 ONLY. Exact live source public views, invented records.
-- Starts transaction, ends unconditional ROLLBACK; no hosted Supabase writes.
-- Demonstrates owner-rights view exposure and review-only invoker/grant defenses.
BEGIN;
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;
CREATE ROLE b71_anon NOLOGIN;
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected','suspended');
CREATE TYPE public.candidate_stage AS ENUM('lead_received','contacted','interested','resume_collected','submitted_to_client','interview_scheduled','interview_completed','selected','offer_released','joined','rejected','dropped');
CREATE TABLE public.billing("id" uuid,"invoice_number" text,"candidate_id" uuid,"client_id" uuid,"salary" numeric,"placement_fee" numeric,"gst" numeric,"invoice_amount" numeric,"payment_status" text,"outstanding_amount" numeric,"invoice_date" date,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz,"candidate_uuid" uuid,"client_uuid" uuid,"offer_uuid" uuid);
CREATE TABLE public.candidates("id" uuid,"candidate_code" text,"full_name" text,"mobile" text,"email" text,"location" text,"position_applied" text,"current_company" text,"experience_years" numeric,"current_salary" numeric,"expected_salary" numeric,"notice_period" text,"resume_url" text,"source" text,"assigned_recruiter" uuid,"stage" public.candidate_stage,"notes" text,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz,"status" text,"created_source" text,"resume_summary" text,"ats_score" int4,"ats_issues" jsonb,"ats_checked_at" timestamptz);
CREATE TABLE public.clients("id" uuid,"company_name" text,"contact_person" text,"phone" text,"email" text,"active_positions" int4,"agreement_type" text,"billing_model" text,"status" text,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz);
CREATE TABLE public.interviews("id" uuid,"candidate_id" uuid,"client_id" uuid,"round" text,"interview_date" date,"interview_time" time,"mode" text,"feedback" text,"status" text,"created_by" uuid,"created_at" timestamptz,"candidate_uuid" uuid,"client_uuid" uuid,"submission_uuid" uuid,"scheduling_token" uuid,"proposed_slots" jsonb);
CREATE TABLE public.job_openings("id" uuid,"job_title" text,"client_id" uuid,"location" text,"salary_min" numeric,"salary_max" numeric,"assigned_recruiter" uuid,"open_positions" int4,"priority" text,"status" text,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz,"client_uuid" uuid,"requirements" text,"description" text,"is_confidential" bool);
CREATE TABLE public.offers("id" uuid,"candidate_id" uuid,"client_id" uuid,"offer_date" date,"joining_date" date,"salary" numeric,"ctc" numeric,"offer_status" text,"joining_status" text,"created_by" uuid,"created_at" timestamptz,"updated_at" timestamptz,"candidate_uuid" uuid,"client_uuid" uuid,"submission_uuid" uuid,"interview_uuid" uuid);
CREATE TABLE public.profiles("id" uuid,"full_name" text,"email" text,"phone" text,"department" text,"role_request" text,"status" public.user_status,"is_active" bool,"created_at" timestamptz,"updated_at" timestamptz);
CREATE TABLE public.submissions("id" uuid,"candidate_id" uuid,"client_id" uuid,"job_id" uuid,"role_title" text,"submission_date" date,"status" text,"remarks" text,"created_by" uuid,"created_at" timestamptz,"candidate_uuid" uuid,"client_uuid" uuid,"job_uuid" uuid);
INSERT INTO public.profiles(id,full_name,email,status,is_active)
 VALUES ('11111111-1111-4111-8111-111111111111','Invented Recruiter','b71@example.invalid','approved',true);
INSERT INTO public.candidates(id,candidate_code,full_name,position_applied,stage,created_at,assigned_recruiter)
 VALUES ('22222222-2222-4222-8222-222222222222','SYNTH-71','Invented Candidate','Invented Role','lead_received',now(),'11111111-1111-4111-8111-111111111111');
INSERT INTO public.billing(id,invoice_number,invoice_amount,salary,candidate_uuid)
 VALUES ('33333333-3333-4333-8333-333333333333','SYNTH-NEVER-ISSUE-71',0,0,'22222222-2222-4222-8222-222222222222');
INSERT INTO public.clients(id,company_name) VALUES ('44444444-4444-4444-8444-444444444444','Invented Client');
INSERT INTO public.interviews(id,candidate_uuid,client_uuid) VALUES ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444');
INSERT INTO public.job_openings(id,job_title,assigned_recruiter) VALUES ('66666666-6666-4666-8666-666666666666','Invented Role','11111111-1111-4111-8111-111111111111');
INSERT INTO public.offers(id,candidate_uuid,offer_status) VALUES ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222','invented_unsent');
INSERT INTO public.submissions(id,candidate_uuid) VALUES ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222');
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
-- Live pg_get_viewdef md5 be4b16ba453445979b692fce4ad76b89; available_recruiters
CREATE VIEW public.available_recruiters AS
SELECT id,
    full_name,
    email,
    'Available'::text AS status
   FROM profiles
  WHERE status = 'approved'::user_status
  ORDER BY full_name;

-- Live pg_get_viewdef md5 fac3fc9311d674f0735ddbb34b4c0bea; candidates_for_assignment
CREATE VIEW public.candidates_for_assignment AS
SELECT id,
    candidate_code,
    full_name,
    position_applied,
    stage,
    created_at,
    assigned_recruiter,
        CASE
            WHEN assigned_recruiter IS NULL THEN 'NOT ASSIGNED'::text
            ELSE 'ASSIGNED'::text
        END AS assignment_status
   FROM candidates
  ORDER BY assigned_recruiter NULLS FIRST, created_at DESC;

-- Live pg_get_viewdef md5 5b47ad70a6abd7be1c4d6897b128627f; recruiter_performance
CREATE VIEW public.recruiter_performance AS
SELECT p.id AS recruiter_id,
    p.full_name AS recruiter_name,
    p.email AS recruiter_email,
    count(c.id) AS total_candidates,
    count(
        CASE
            WHEN c.stage = 'lead_received'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS lead_received,
    count(
        CASE
            WHEN c.stage = 'contacted'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS contacted,
    count(
        CASE
            WHEN c.stage = 'interested'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS interested,
    count(
        CASE
            WHEN c.stage = 'resume_collected'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS resume_collected,
    count(
        CASE
            WHEN c.stage = 'submitted_to_client'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS submitted_to_client,
    count(
        CASE
            WHEN c.stage = 'interview_scheduled'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS interview_scheduled,
    count(
        CASE
            WHEN c.stage = 'interview_completed'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS interview_completed,
    count(
        CASE
            WHEN c.stage = 'selected'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS selected,
    count(
        CASE
            WHEN c.stage = 'offer_released'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS offer_released,
    count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS joined,
    count(
        CASE
            WHEN c.stage = 'rejected'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS rejected,
    count(
        CASE
            WHEN c.stage = 'dropped'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS dropped,
    count(
        CASE
            WHEN c.created_at > (now() - '30 days'::interval) THEN 1
            ELSE NULL::integer
        END) AS last_30_days,
    round(count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END)::numeric / NULLIF(count(
        CASE
            WHEN c.stage = 'selected'::candidate_stage THEN 1
            ELSE NULL::integer
        END), 0)::numeric * 100::numeric, 2) AS conversion_to_join_rate
   FROM profiles p
     LEFT JOIN candidates c ON c.assigned_recruiter = p.id
  WHERE p.status = 'approved'::user_status
  GROUP BY p.id, p.full_name, p.email
  ORDER BY (count(c.id)) DESC;

-- Live pg_get_viewdef md5 95e34f87e7e4f11ca82d19887dd05546; recruiter_performance_with_names
CREATE VIEW public.recruiter_performance_with_names AS
SELECT p.full_name AS recruiter_name,
    p.id AS recruiter_id,
    count(c.id) AS total_candidates,
    count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS placements,
    count(
        CASE
            WHEN c.stage = 'lead_received'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS new_leads,
    count(
        CASE
            WHEN c.stage = ANY (ARRAY['interview_scheduled'::candidate_stage, 'interview_completed'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS interviewing,
    count(
        CASE
            WHEN c.stage = ANY (ARRAY['rejected'::candidate_stage, 'dropped'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS lost,
    round(count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END)::numeric / NULLIF(count(c.id), 0)::numeric * 100::numeric, 2) AS placement_rate
   FROM profiles p
     LEFT JOIN candidates c ON c.assigned_recruiter = p.id
  WHERE p.status = 'approved'::user_status
  GROUP BY p.id, p.full_name
  ORDER BY (count(c.id)) DESC;

-- Live pg_get_viewdef md5 d1c7c0dd3475898cdc5b2ee02c1f0cde; recruiter_stats
CREATE VIEW public.recruiter_stats AS
SELECT p.id,
    p.full_name,
    count(c.id) AS total,
    count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS placed,
    count(
        CASE
            WHEN c.stage = 'lead_received'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS new_leads,
    count(
        CASE
            WHEN c.stage = ANY (ARRAY['interview_scheduled'::candidate_stage, 'interview_completed'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS interviewing,
    round(count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END)::numeric / NULLIF(count(c.id), 0)::numeric * 100::numeric, 2) AS conversion_rate
   FROM profiles p
     LEFT JOIN candidates c ON c.assigned_recruiter = p.id
  WHERE p.status = 'approved'::user_status
  GROUP BY p.id, p.full_name
  ORDER BY (count(c.id)) DESC;

-- Live pg_get_viewdef md5 f96652112290df365e786c23320d5938; recruiter_summary
CREATE VIEW public.recruiter_summary AS
SELECT p.full_name AS recruiter,
    count(c.id) AS total_candidates,
    count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END) AS hires,
    count(
        CASE
            WHEN c.stage = ANY (ARRAY['rejected'::candidate_stage, 'dropped'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS lost,
    count(
        CASE
            WHEN c.stage <> ALL (ARRAY['joined'::candidate_stage, 'rejected'::candidate_stage, 'dropped'::candidate_stage]) THEN 1
            ELSE NULL::integer
        END) AS active_pipeline
   FROM profiles p
     LEFT JOIN candidates c ON c.assigned_recruiter = p.id
  WHERE p.status = 'approved'::user_status
  GROUP BY p.id, p.full_name
  ORDER BY (count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END)) DESC;

-- Live pg_get_viewdef md5 005700ffaf4b7fc8e3957445a2d41413; vw_billing_filters
CREATE VIEW public.vw_billing_filters AS
SELECT id,
    invoice_number,
    candidate_id,
    client_id,
    salary,
    placement_fee,
    gst,
    invoice_amount,
    payment_status,
    outstanding_amount,
    invoice_date,
    created_by,
    created_at,
    updated_at,
    candidate_uuid,
    client_uuid,
    offer_uuid
   FROM billing;

-- Live pg_get_viewdef md5 d1471d48998dfc2bf6fba92862331aab; vw_candidate_filters
CREATE VIEW public.vw_candidate_filters AS
SELECT id,
    candidate_code,
    full_name,
    location,
    position_applied,
    experience_years,
    status,
    stage,
    assigned_recruiter,
    created_at
   FROM candidates;

-- Live pg_get_viewdef md5 0da6b3ac023805637feaf4a31170d525; vw_client_filters
CREATE VIEW public.vw_client_filters AS
SELECT id,
    company_name,
    contact_person,
    status,
    agreement_type,
    billing_model,
    active_positions,
    created_at
   FROM clients;

-- Live pg_get_viewdef md5 802fa2546b71e09b63545668e6d9dd08; vw_interview_filters
CREATE VIEW public.vw_interview_filters AS
SELECT id,
    candidate_id,
    client_id,
    round,
    interview_date,
    interview_time,
    mode,
    feedback,
    status,
    created_by,
    created_at,
    candidate_uuid,
    client_uuid,
    submission_uuid
   FROM interviews;

-- Live pg_get_viewdef md5 4fcfff9411bf90fc94651c46a09e84de; vw_job_filters
CREATE VIEW public.vw_job_filters AS
SELECT id,
    job_title,
    location,
    priority,
    status,
    assigned_recruiter,
    open_positions,
    created_at
   FROM job_openings;

-- Live pg_get_viewdef md5 e18c25f23b5312b13489689cd279b5be; vw_offer_filters
CREATE VIEW public.vw_offer_filters AS
SELECT id,
    candidate_id,
    client_id,
    offer_date,
    joining_date,
    salary,
    ctc,
    offer_status,
    joining_status,
    created_by,
    created_at,
    updated_at,
    candidate_uuid,
    client_uuid,
    submission_uuid,
    interview_uuid
   FROM offers;

-- Live pg_get_viewdef md5 8a24b9878d98a42ab794cf06d60410d1; vw_submission_filters
CREATE VIEW public.vw_submission_filters AS
SELECT id,
    candidate_id,
    client_id,
    job_id,
    role_title,
    submission_date,
    status,
    remarks,
    created_by,
    created_at,
    candidate_uuid,
    client_uuid,
    job_uuid
   FROM submissions;
GRANT USAGE ON SCHEMA public TO b71_anon;
GRANT SELECT ON public.available_recruiters,public.candidates_for_assignment,public.recruiter_performance,public.recruiter_performance_with_names,public.recruiter_stats,public.recruiter_summary,public.vw_billing_filters,public.vw_candidate_filters,public.vw_client_filters,public.vw_interview_filters,public.vw_job_filters,public.vw_offer_filters,public.vw_submission_filters TO b71_anon;
SET LOCAL ROLE b71_anon;
-- Before remediation: definer views owned by postgres bypass underlying RLS.
DO $unsafe$
DECLARE view_name text; exposed_rows bigint;
BEGIN
 FOREACH view_name IN ARRAY ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',view_name) INTO exposed_rows;
  IF exposed_rows<>1 THEN
   RAISE EXCEPTION 'Expected one invented row leaked by definer view %, observed %',view_name,exposed_rows;
  END IF;
 END LOOP;
END $unsafe$;
RESET ROLE;
-- Layer 1: invoker mode without view-level grant change must refuse anon
-- because the private source tables have no anon SELECT grant.
ALTER VIEW public.available_recruiters SET (security_invoker=true);
ALTER VIEW public.candidates_for_assignment SET (security_invoker=true);
ALTER VIEW public.recruiter_performance SET (security_invoker=true);
ALTER VIEW public.recruiter_performance_with_names SET (security_invoker=true);
ALTER VIEW public.recruiter_stats SET (security_invoker=true);
ALTER VIEW public.recruiter_summary SET (security_invoker=true);
ALTER VIEW public.vw_billing_filters SET (security_invoker=true);
ALTER VIEW public.vw_candidate_filters SET (security_invoker=true);
ALTER VIEW public.vw_client_filters SET (security_invoker=true);
ALTER VIEW public.vw_interview_filters SET (security_invoker=true);
ALTER VIEW public.vw_job_filters SET (security_invoker=true);
ALTER VIEW public.vw_offer_filters SET (security_invoker=true);
ALTER VIEW public.vw_submission_filters SET (security_invoker=true);
SET LOCAL ROLE b71_anon;
DO $invoker$
DECLARE view_name text; touched bigint; denied boolean;
BEGIN
 FOREACH view_name IN ARRAY ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters'] LOOP
  denied:=false;
  BEGIN
   EXECUTE format('SELECT count(*) FROM public.%I',view_name) INTO touched;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Invoker view % unexpectedly readable anonymously',view_name; END IF;
 END LOOP;
END $invoker$;
RESET ROLE;
-- Layer 2: even with SELECT granted on a private base table, RLS must
-- prevent anonymous rows, rather than merely giving a permission error.
GRANT SELECT ON public.billing TO b71_anon;
SET LOCAL ROLE b71_anon;
DO $rls$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM public.vw_billing_filters;
 IF n<>0 THEN RAISE EXCEPTION 'Anonymous billing rows leaked despite RLS: %',n; END IF;
END $rls$;
RESET ROLE;
-- Layer 3: revoke public view SELECT so anonymous callers cannot even query it.
REVOKE SELECT ON public.available_recruiters,public.candidates_for_assignment,public.recruiter_performance,public.recruiter_performance_with_names,public.recruiter_stats,public.recruiter_summary,public.vw_billing_filters,public.vw_candidate_filters,public.vw_client_filters,public.vw_interview_filters,public.vw_job_filters,public.vw_offer_filters,public.vw_submission_filters FROM b71_anon;
SET LOCAL ROLE b71_anon;
DO $denied$
DECLARE view_name text; touched bigint; denied boolean;
BEGIN
 FOREACH view_name IN ARRAY ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters'] LOOP
  denied:=false;
  BEGIN
   EXECUTE format('SELECT count(*) FROM public.%I',view_name) INTO touched;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Revoked view % unexpectedly readable anonymously',view_name; END IF;
 END LOOP;
END $denied$;
RESET ROLE;
ROLLBACK;
