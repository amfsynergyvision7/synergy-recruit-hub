-- Original candidate-sync migration, synthetic records only, transaction rollback.
BEGIN;
CREATE TYPE public.candidate_stage AS ENUM ('lead_received','screening');
CREATE TABLE public.candidates (
 id uuid PRIMARY KEY,
 candidate_code text,
 stage public.candidate_stage,
 mobile text,
 email text,
 updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.integrations (id uuid PRIMARY KEY,updated_at timestamptz DEFAULT now());
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
\ir ../../supabase/migrations/20260513105209_62552999-3585-4ac5-a790-c2b991eafaa5.sql
INSERT INTO public.candidates(id,email) VALUES
('00000000-0000-0000-0000-000000000001','synthetic@example.invalid');
DO $$
DECLARE r record;
BEGIN
 SELECT candidate_code,stage,status INTO r FROM public.candidates LIMIT 1;
 IF r.candidate_code !~ '^CAND-[0-9]+$' OR r.stage<>'lead_received'::public.candidate_stage OR r.status<>'active'
 THEN RAISE EXCEPTION 'Candidate sync defaults did not fire'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.candidates'::regclass
 AND tgname IN ('candidates_sync_defaults_trigger','candidates_updated_at_trigger') AND NOT tgisinternal)<>2
 THEN RAISE EXCEPTION 'Candidate sync trigger count incorrect'; END IF;
END $$;
\ir ../../supabase/migrations/20260513105209_62552999-3585-4ac5-a790-c2b991eafaa5.sql
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.candidates'::regclass
 AND tgname IN ('candidates_sync_defaults_trigger','candidates_updated_at_trigger') AND NOT tgisinternal)<>2
 THEN RAISE EXCEPTION 'Candidate sync repeat replay duplicated triggers'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF to_regclass('public.candidates') IS NOT NULL OR to_regclass('public.candidate_code_seq') IS NOT NULL
 THEN RAISE EXCEPTION 'Candidate sync fixture survived rollback'; END IF;
END $$;
SELECT 'PASS: original candidate sync migration replayed twice with synthetic defaults and rollback' AS result;
