-- Original trigger and privilege migration on synthetic objects only.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SEQUENCE public.candidate_code_seq;
CREATE SEQUENCE public.invoice_seq;
CREATE TABLE public.billing(updated_at timestamptz,invoice_number text);
CREATE TABLE public.candidates(updated_at timestamptz,candidate_code text);
CREATE TABLE public.interviews(updated_at timestamptz);
CREATE TABLE public.job_openings(updated_at timestamptz);
CREATE TABLE public.offers(updated_at timestamptz);
CREATE TABLE public.submissions(updated_at timestamptz);
-- Create all dependency functions with exact signatures, without real workflow logic.
CREATE FUNCTION public.on_submission_insert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE FUNCTION public.on_interview_change() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE FUNCTION public.on_offer_change() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE FUNCTION public.normalize_job_opening_relationships() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE FUNCTION public.normalize_submission_relationships() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE FUNCTION public.normalize_interview_relationships() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE FUNCTION public.normalize_offer_relationships() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE FUNCTION public.normalize_billing_relationships() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE FUNCTION public.on_candidate_insert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE FUNCTION public.resolve_candidate_uuid(text) RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
CREATE FUNCTION public.resolve_client_uuid(text) RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
CREATE FUNCTION public.resolve_job_uuid(text) RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
\ir ../../supabase/migrations/20260513091732_dfcdf0fd-5601-45aa-acf1-1779827843cc.sql
DO $$
BEGIN
 IF has_function_privilege('anon','public.set_updated_at()','EXECUTE')
 OR has_function_privilege('authenticated','public.set_invoice_number()','EXECUTE')
 OR has_function_privilege('authenticated','public.on_candidate_insert()','EXECUTE')
 THEN RAISE EXCEPTION 'Sensitive function remains callable'; END IF;
 IF (SELECT proconfig FROM pg_proc WHERE oid='public.set_invoice_number()'::regprocedure)
 IS NULL THEN RAISE EXCEPTION 'Search path not fixed'; END IF;
END $$;
\ir ../../supabase/migrations/20260513091732_dfcdf0fd-5601-45aa-acf1-1779827843cc.sql
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.billing') IS NOT NULL OR to_regclass('public.candidate_code_seq') IS NOT NULL
 THEN RAISE EXCEPTION 'Privilege fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: original trigger privilege migration replayed twice on synthetic objects' AS result;
