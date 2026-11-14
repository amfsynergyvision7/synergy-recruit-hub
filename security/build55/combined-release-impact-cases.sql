-- Build55: assert delete impact is read-only after full 67->35 policy swap.
SET ROLE authenticated;
DO $b55_full_release$
DECLARE j jsonb; before_count bigint;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 SELECT count(*) INTO before_count FROM public.candidates;
 j:=public.crm_candidate_delete_impact('11111111-1111-4111-8111-111111111111');
 IF j->>'operation'<>'review_only'
 OR (j->>'allowed_to_delete')::boolean IS DISTINCT FROM false
 OR (j->>'no_mutation_performed')::boolean IS DISTINCT FROM true
 OR (j->'cascade_delete'->>'submissions')::bigint<>0
 THEN RAISE EXCEPTION 'Full-lockdown deletion impact was not safe'; END IF;
 IF (SELECT count(*) FROM public.candidates)<>before_count
 THEN RAISE EXCEPTION 'Read-only deletion impact modified candidate'; END IF;
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 BEGIN
  PERFORM public.crm_candidate_delete_impact('11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'Full-lockdown recruiter viewed deletion metadata';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $b55_full_release$;
RESET ROLE;
SET ROLE anon;
DO $b55_full_anon$
BEGIN
 BEGIN
  PERFORM public.crm_candidate_delete_impact('11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'Full-lockdown anon deletion metadata access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $b55_full_anon$;
RESET ROLE;
