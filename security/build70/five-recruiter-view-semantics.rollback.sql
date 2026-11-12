-- BUILD70: DISPOSABLE POSTGRES ONLY. Begins transaction, ends unconditional ROLLBACK.
-- Uses verified pg_get_viewdef sources with original MD5, no real identities or business records.
-- NOT deployable; exact source review and human approvals remain mandatory.
BEGIN;
SET LOCAL statement_timeout='60s';
CREATE TYPE public.user_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.candidate_stage AS ENUM ('contacted','dropped','interested','interview_completed','interview_scheduled','joined','lead_received','offer_released','rejected','resume_collected','selected','submitted_to_client');
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text, email text, status public.user_status, is_active boolean);
CREATE TABLE public.user_roles(user_id uuid NOT NULL, role public.app_role NOT NULL);
CREATE TABLE public.candidates(id uuid PRIMARY KEY,assigned_recruiter uuid,stage public.candidate_stage,created_at timestamptz DEFAULT now());
INSERT INTO public.profiles(id,full_name,email,status,is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Synthetic Admin','synthetic-1@example.invalid','approved',true),
 ('11111111-1111-4111-8111-111111111111','Synthetic Recruiter A','synthetic-2@example.invalid','approved',true),
 ('22222222-2222-4222-8222-222222222222','Synthetic Recruiter B','synthetic-3@example.invalid','approved',true),
 ('33333333-3333-4333-8333-333333333333','Synthetic Finance','synthetic-4@example.invalid','approved',true),
 ('44444444-4444-4444-8444-444444444444','Synthetic Operations','synthetic-5@example.invalid','approved',true),
 ('55555555-5555-4555-8555-555555555555','Synthetic Pending','synthetic-6@example.invalid','pending',true),
 ('66666666-6666-4666-8666-666666666666','Synthetic Inactive','synthetic-7@example.invalid','approved',false),
 ('77777777-7777-4777-8777-777777777777','Synthetic Viewer','synthetic-8@example.invalid','approved',true);
INSERT INTO public.user_roles(user_id,role) VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),
 ('11111111-1111-4111-8111-111111111111','recruiter'),
 ('22222222-2222-4222-8222-222222222222','recruiter'),
 ('33333333-3333-4333-8333-333333333333','finance'),
 ('44444444-4444-4444-8444-444444444444','operations'),
 ('55555555-5555-4555-8555-555555555555','recruiter'),
 ('66666666-6666-4666-8666-666666666666','recruiter'),
 ('77777777-7777-4777-8777-777777777777','viewer');
INSERT INTO public.candidates(id,assigned_recruiter,stage) VALUES
 ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','lead_received'),
 ('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','joined');
-- Exact live source SQL for five views, bound to Build69 MD5s.
-- actual live source MD5 be4b16ba453445979b692fce4ad76b89; available_recruiters
CREATE VIEW public.available_recruiters AS
SELECT id,
    full_name,
    email,
    'Available'::text AS status
   FROM profiles
  WHERE status = 'approved'::user_status
  ORDER BY full_name;

-- actual live source MD5 5b47ad70a6abd7be1c4d6897b128627f; recruiter_performance
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

-- actual live source MD5 95e34f87e7e4f11ca82d19887dd05546; recruiter_performance_with_names
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

-- actual live source MD5 d1c7c0dd3475898cdc5b2ee02c1f0cde; recruiter_stats
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

-- actual live source MD5 f96652112290df365e786c23320d5938; recruiter_summary
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
CREATE TEMP TABLE before_schema AS
 SELECT table_name,column_name,udt_name,ordinal_position
 FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('available_recruiters','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary');
DO $test$
DECLARE name text; rows_found int;
BEGIN
 FOREACH name IN ARRAY ARRAY['available_recruiters','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',name) INTO rows_found;
  IF rows_found<>7 THEN
   RAISE EXCEPTION 'Original production view % should include 7 approved profiles, got %',name,rows_found;
  END IF;
 END LOOP;
END $test$;
-- Side-by-side proposed semantics, no production migration or source fingerprint updates.
-- DRAFT semantic correction in disposable fixture ONLY, source be4b16ba453445979b692fce4ad76b89
CREATE OR REPLACE VIEW public.available_recruiters WITH (security_invoker=true) AS
SELECT id,
    full_name,
    email,
    'Available'::text AS status
   FROM profiles
  WHERE status = 'approved'::user_status
 AND profiles.is_active = true
 AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.id AND ur.role = 'recruiter'::public.app_role)
  ORDER BY full_name;

-- DRAFT semantic correction in disposable fixture ONLY, source 5b47ad70a6abd7be1c4d6897b128627f
CREATE OR REPLACE VIEW public.recruiter_performance WITH (security_invoker=true) AS
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
 AND p.is_active = true
 AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'recruiter'::public.app_role)
  GROUP BY p.id, p.full_name, p.email
  ORDER BY (count(c.id)) DESC;

-- DRAFT semantic correction in disposable fixture ONLY, source 95e34f87e7e4f11ca82d19887dd05546
CREATE OR REPLACE VIEW public.recruiter_performance_with_names WITH (security_invoker=true) AS
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
 AND p.is_active = true
 AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'recruiter'::public.app_role)
  GROUP BY p.id, p.full_name
  ORDER BY (count(c.id)) DESC;

-- DRAFT semantic correction in disposable fixture ONLY, source d1c7c0dd3475898cdc5b2ee02c1f0cde
CREATE OR REPLACE VIEW public.recruiter_stats WITH (security_invoker=true) AS
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
 AND p.is_active = true
 AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'recruiter'::public.app_role)
  GROUP BY p.id, p.full_name
  ORDER BY (count(c.id)) DESC;

-- DRAFT semantic correction in disposable fixture ONLY, source f96652112290df365e786c23320d5938
CREATE OR REPLACE VIEW public.recruiter_summary WITH (security_invoker=true) AS
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
 AND p.is_active = true
 AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'recruiter'::public.app_role)
  GROUP BY p.id, p.full_name
  ORDER BY (count(
        CASE
            WHEN c.stage = 'joined'::candidate_stage THEN 1
            ELSE NULL::integer
        END)) DESC;
DO $test$
DECLARE name text; rows_found int; invoker_count int;
BEGIN
 FOREACH name IN ARRAY ARRAY['available_recruiters','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',name) INTO rows_found;
  IF rows_found<>2 THEN RAISE EXCEPTION 'Hardened view % expected only two active recruiters, got %',name,rows_found; END IF;
 END LOOP;
 SELECT count(*) INTO invoker_count FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('available_recruiters','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary') AND
 c.reloptions @> ARRAY['security_invoker=true']::text[];
 IF invoker_count<>5 THEN RAISE EXCEPTION 'Expected all five security_invoker views, got %',invoker_count; END IF;
 IF EXISTS (
  (SELECT table_name,column_name,udt_name,ordinal_position FROM before_schema
   EXCEPT SELECT table_name,column_name,udt_name,ordinal_position FROM information_schema.columns
   WHERE table_schema='public' AND table_name IN ('available_recruiters','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary'))
  UNION ALL
  (SELECT table_name,column_name,udt_name,ordinal_position FROM information_schema.columns
   WHERE table_schema='public' AND table_name IN ('available_recruiters','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary')
   EXCEPT SELECT table_name,column_name,udt_name,ordinal_position FROM before_schema)
 ) THEN RAISE EXCEPTION 'Changed public view output schema'; END IF;
END $test$;
-- Confirm synthetic candidate counts and distinct, nonrecruiter exclusion.
DO $test$
DECLARE total bigint;
BEGIN
 SELECT count(*) INTO total FROM public.available_recruiters
 WHERE id NOT IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
 IF total<>0 THEN RAISE EXCEPTION 'Nonrecruiter visible'; END IF;
 SELECT sum(total_candidates) INTO total FROM public.recruiter_performance;
 IF total<>2 THEN RAISE EXCEPTION 'Invented recruiter metrics mismatch'; END IF;
END $test$;
ROLLBACK;
