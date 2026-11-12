-- Build77 structural nonproduction-only views. Derived from production view DEFINITIONS, not data.
-- All views are security_invoker and explicitly denied to anon and authenticated.
DO $guard$ BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') <> 19 THEN RAISE EXCEPTION 'Build77 views require 19 tables'; END IF;
 IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public') THEN RAISE EXCEPTION 'Build77 refuses existing public views'; END IF;
END $guard$;
CREATE VIEW public."available_recruiters" WITH (security_invoker=true) AS
SELECT id,
    full_name,
    email,
    'Available'::text AS status
   FROM profiles
  WHERE status = 'approved'::user_status
  ORDER BY full_name;
REVOKE ALL ON TABLE public."available_recruiters" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."candidates_for_assignment" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."candidates_for_assignment" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."recruiter_performance" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."recruiter_performance" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."recruiter_performance_with_names" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."recruiter_performance_with_names" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."recruiter_stats" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."recruiter_stats" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."recruiter_summary" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."recruiter_summary" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."vw_billing_filters" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."vw_billing_filters" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."vw_candidate_filters" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."vw_candidate_filters" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."vw_client_filters" WITH (security_invoker=true) AS
SELECT id,
    company_name,
    contact_person,
    status,
    agreement_type,
    billing_model,
    active_positions,
    created_at
   FROM clients;
REVOKE ALL ON TABLE public."vw_client_filters" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."vw_interview_filters" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."vw_interview_filters" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."vw_job_filters" WITH (security_invoker=true) AS
SELECT id,
    job_title,
    location,
    priority,
    status,
    assigned_recruiter,
    open_positions,
    created_at
   FROM job_openings;
REVOKE ALL ON TABLE public."vw_job_filters" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."vw_offer_filters" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."vw_offer_filters" FROM PUBLIC, anon, authenticated;
CREATE VIEW public."vw_submission_filters" WITH (security_invoker=true) AS
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
REVOKE ALL ON TABLE public."vw_submission_filters" FROM PUBLIC, anon, authenticated;
