-- Build58 EXACT live function definitions, synthetic PostgreSQL only.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
SET LOCAL statement_timeout='30s';
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $b58auth$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$b58auth$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text,email text,status text);
CREATE TABLE public.candidates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 full_name text,email text,mobile text,current_company text,position_applied text,
 stage text,assigned_recruiter uuid,created_at timestamptz DEFAULT clock_timestamp(),
 updated_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.candidate_stage_history(
 candidate_id uuid,previous_stage text,new_stage text,changed_by uuid);

CREATE OR REPLACE FUNCTION public.get_recruiter_stats(start_date date DEFAULT (now() - '30 days'::interval), end_date date DEFAULT now())
 RETURNS TABLE(recruiter_name text, recruiter_email text, total_candidates bigint, joined_count bigint, rejected_count bigint, active_pipeline bigint, avg_time_to_join integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        p.full_name,
        p.email,
        COUNT(DISTINCT c.id) as total_candidates,
        COUNT(DISTINCT CASE WHEN c.stage = 'joined' THEN c.id END) as joined_count,
        COUNT(DISTINCT CASE WHEN c.stage IN ('rejected', 'dropped') THEN c.id END) as rejected_count,
        COUNT(DISTINCT CASE WHEN c.stage NOT IN ('joined', 'rejected', 'dropped') THEN c.id END) as active_pipeline,
        AVG(EXTRACT(DAY FROM (c.updated_at - c.created_at)))::INT as avg_time_to_join
    FROM profiles p
    LEFT JOIN candidates c ON c.assigned_recruiter = p.id 
        AND c.created_at BETWEEN start_date AND end_date
    WHERE p.status = 'approved'
    GROUP BY p.id, p.full_name, p.email
    HAVING COUNT(c.id) > 0
    ORDER BY total_candidates DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_candidates(search_term text)
 RETURNS SETOF candidates
 LANGUAGE sql
AS $function$
SELECT *
FROM candidates
WHERE
    full_name ILIKE '%' || search_term || '%'
    OR email ILIKE '%' || search_term || '%'
    OR mobile ILIKE '%' || search_term || '%'
    OR current_company ILIKE '%' || search_term || '%'
    OR position_applied ILIKE '%' || search_term || '%'
ORDER BY created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.set_assigned_recruiter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- If assigned_recruiter is NULL, set to current user
    IF NEW.assigned_recruiter IS NULL THEN
        NEW.assigned_recruiter := auth.uid();
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_stage_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO candidate_stage_history (
            candidate_id, 
            previous_stage, 
            new_stage, 
            changed_by
        ) VALUES (
            NEW.id, 
            OLD.stage, 
            NEW.stage, 
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE TRIGGER b58_assign BEFORE INSERT ON public.candidates
 FOR EACH ROW EXECUTE FUNCTION public.set_assigned_recruiter();
CREATE TRIGGER b58_stage AFTER UPDATE OF stage ON public.candidates
 FOR EACH ROW EXECUTE FUNCTION public.track_stage_changes();
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC,anon,authenticated,service_role;
-- Build58 source-exact security fix, REVIEW ONLY.
DO $b58_before$
DECLARE n int; h text; vulnerable int; definers int;
BEGIN
 SELECT count(*),
 md5(string_agg(p.proname||E'\x1f'||pg_get_function_identity_arguments(p.oid)
 ||E'\x1f'||p.prosecdef||E'\x1f'||coalesce(p.proconfig::text,'<NULL>')
 ||E'\x1f'||pg_get_functiondef(p.oid),E'\n'
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid))),
 count(*) FILTER(WHERE p.proconfig IS NULL),count(*) FILTER(WHERE p.prosecdef)
 INTO n,h,vulnerable,definers
 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.proname IN
 ('get_recruiter_stats','search_candidates','set_assigned_recruiter','track_stage_changes');
 IF n<>4 OR h<>'ea5005b2208a2d0891e3f8004fd7de80' OR vulnerable<>4 OR definers<>2 THEN
  RAISE EXCEPTION 'Build58 exact live function source drift: n %, digest %, mutable %, definers %',n,h,vulnerable,definers
   USING ERRCODE='42501';
 END IF;
END $b58_before$;

ALTER FUNCTION public.get_recruiter_stats(date,date) SET search_path=pg_catalog,public;
ALTER FUNCTION public.search_candidates(text) SET search_path=pg_catalog,public;
ALTER FUNCTION public.set_assigned_recruiter() SET search_path=pg_catalog,public;
ALTER FUNCTION public.track_stage_changes() SET search_path=pg_catalog,public;

REVOKE ALL ON FUNCTION public.get_recruiter_stats(date,date),
 public.search_candidates(text),public.set_assigned_recruiter(),
 public.track_stage_changes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_recruiter_stats(date,date),
 public.search_candidates(text) TO authenticated;
REVOKE ALL ON FUNCTION public.set_assigned_recruiter(),
 public.track_stage_changes() FROM authenticated,service_role;

DO $b58_after$
DECLARE n int; f record;
BEGIN
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.proname IN
 ('get_recruiter_stats','search_candidates','set_assigned_recruiter','track_stage_changes')
 AND p.proconfig @> ARRAY['search_path=pg_catalog,public']::text[];
 IF n<>4 THEN RAISE EXCEPTION 'Build58 not all function search paths fixed'; END IF;
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.proname IN
 ('get_recruiter_stats','search_candidates','set_assigned_recruiter','track_stage_changes')
 LOOP
  IF has_function_privilege('anon',f.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Anonymous function execution remains';
  END IF;
 END LOOP;
 IF has_function_privilege('authenticated','public.set_assigned_recruiter()','EXECUTE')
 OR has_function_privilege('authenticated','public.track_stage_changes()','EXECUTE') THEN
  RAISE EXCEPTION 'Trigger functions still web callable';
 END IF;
 IF NOT has_function_privilege('authenticated','public.search_candidates(text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.get_recruiter_stats(date,date)','EXECUTE') THEN
  RAISE EXCEPTION 'Signed-in read RPCs lost';
 END IF;
END $b58_after$;

DO $b58_behavior$
DECLARE actor uuid:='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'; n int;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 INSERT INTO public.profiles VALUES(actor,'Synthetic Recruiter','recruiter@example.invalid','approved');
 INSERT INTO public.candidates(id,full_name,email,mobile,stage)
 VALUES('11111111-1111-4111-8111-111111111111','SYNTHETIC SUBJECT','x@example.invalid','0000','lead_received');
 IF NOT EXISTS(SELECT 1 FROM public.candidates WHERE assigned_recruiter=actor)
 THEN RAISE EXCEPTION 'Assign trigger broke'; END IF;
 UPDATE public.candidates SET stage='contacted'
 WHERE id='11111111-1111-4111-8111-111111111111';
 IF NOT EXISTS(SELECT 1 FROM public.candidate_stage_history
 WHERE changed_by=actor AND previous_stage='lead_received' AND new_stage='contacted')
 THEN RAISE EXCEPTION 'Stage history trigger broke'; END IF;
 SELECT count(*) INTO n FROM public.search_candidates('SYNTHETIC');
 IF n<>1 THEN RAISE EXCEPTION 'Search RPC broke'; END IF;
 SELECT count(*) INTO n FROM public.get_recruiter_stats(current_date-30,current_date+1);
 IF n<>1 THEN RAISE EXCEPTION 'Recruiter stats RPC broke'; END IF;
END $b58_behavior$;
SET ROLE anon;
DO $b58_anon$
BEGIN
 BEGIN PERFORM public.search_candidates('SYNTHETIC');
 RAISE EXCEPTION 'Anon search still callable';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.set_assigned_recruiter();
 RAISE EXCEPTION 'Anon trigger RPC still callable';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $b58_anon$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS Build58 four source-exact functions hardened, both triggers and read RPCs intact, anon denied, rolled back' AS outcome;
