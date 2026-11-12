-- BUILD55 role/snapshot assessment, all synthetic. NO permanent DELETE.
SET ROLE authenticated;
DO $b55_admin$
DECLARE j jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 j:=public.crm_candidate_delete_impact('11111111-1111-4111-8111-111111111111');
 IF j->>'operation'<>'review_only' OR (j->>'allowed_to_delete')::boolean
 OR (j->>'no_mutation_performed')::boolean IS DISTINCT FROM true
 OR (j->'cascade_delete'->>'submissions')::integer<>2
 OR (j->'cascade_delete'->>'interviews')::integer<>2
 OR (j->'cascade_delete'->>'offers')::integer<>2
 OR (j->'cascade_delete'->>'candidate_stage_history')::integer<>1
 OR (j->'foreign_keys_set_null'->>'billing')::integer<>1
 THEN RAISE EXCEPTION 'Read-only candidate deletion impact counts invalid: %',j; END IF;
 IF j::text ILIKE '%synthetic recruiter%' OR j::text ILIKE '%@example.invalid%'
 THEN RAISE EXCEPTION 'Deletion assessment leaked candidate PII'; END IF;
 BEGIN
  PERFORM public.crm_candidate_delete_impact('99999999-9999-4999-8999-999999999999');
  RAISE EXCEPTION 'Nonexistent candidate accepted';
 EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL; END;
END $b55_admin$;
DO $b55_recruiter$
BEGIN
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 BEGIN
  PERFORM public.crm_candidate_delete_impact('11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'Recruiter gained deletion impact metadata';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
 BEGIN
  PERFORM public.crm_candidate_delete_impact('11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'Pending account gained deletion impact metadata';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
 BEGIN
  PERFORM public.crm_candidate_delete_impact('11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'Suspended admin gained deletion impact metadata';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $b55_recruiter$;
RESET ROLE;
DO $b55_fks$
DECLARE n int;
BEGIN
 IF has_function_privilege('anon','public.crm_candidate_delete_impact(uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.crm_candidate_delete_impact(uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.crm_candidate_delete_impact(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Deletion-impact function grants incorrect'; END IF;
 SELECT count(*) INTO n FROM public.candidates
  WHERE id='11111111-1111-4111-8111-111111111111';
 IF n<>1 THEN RAISE EXCEPTION 'Impact assessment modified candidate'; END IF;
 SELECT count(*) INTO n FROM public.submissions;
 IF n<>2 THEN RAISE EXCEPTION 'Impact assessment deleted submissions'; END IF;
 SELECT count(*) INTO n FROM public.billing WHERE candidate_id IS NOT NULL;
 IF n<>1 THEN RAISE EXCEPTION 'Impact assessment orphaned billing'; END IF;
 -- Reproduce irreversible legacy hazard inside a caught exception subtransaction.
 -- The nested exception deliberately rolls back cascade + SET NULL effects.
 BEGIN
   DELETE FROM public.candidates WHERE id='11111111-1111-4111-8111-111111111111';
   IF EXISTS(SELECT 1 FROM public.submissions)
     OR EXISTS(SELECT 1 FROM public.offers)
     OR EXISTS(SELECT 1 FROM public.interviews)
     OR EXISTS(SELECT 1 FROM public.candidate_stage_history)
   THEN RAISE EXCEPTION 'Expected child cascade did not happen'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.billing
     WHERE candidate_id IS NULL AND candidate_uuid IS NULL)
   THEN RAISE EXCEPTION 'Expected billing FK detach did not happen'; END IF;
   RAISE EXCEPTION 'Never persist legacy deletion' USING ERRCODE='P5511';
 EXCEPTION WHEN SQLSTATE 'P5511' THEN NULL; END;
 SELECT count(*) INTO n FROM public.submissions;
 IF n<>2 THEN RAISE EXCEPTION 'Caught subtransaction failed to restore related rows'; END IF;
 IF EXISTS(SELECT 1 FROM public.billing WHERE candidate_id IS NULL)
 THEN RAISE EXCEPTION 'Caught subtransaction left detached billing'; END IF;
END $b55_fks$;
SET ROLE anon;
DO $b55_anon$
BEGIN
 BEGIN
  PERFORM public.crm_candidate_delete_impact('11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'Anonymous candidate metadata assessment allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $b55_anon$;
RESET ROLE;
