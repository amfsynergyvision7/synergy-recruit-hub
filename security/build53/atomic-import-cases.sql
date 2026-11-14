-- Build53: append inside the existing Build52 synthetic transaction, before ROLLBACK.
-- All identities/data are test-only; hosted Auth users are NEVER created.
DO $build53_acl$
BEGIN
 IF has_table_privilege('authenticated','crm_private.candidate_import_batches','SELECT')
    OR has_table_privilege('anon','crm_private.candidate_import_batches','SELECT')
    OR has_schema_privilege('authenticated','crm_private','USAGE')
    OR has_schema_privilege('anon','crm_private','USAGE')
    OR has_function_privilege('anon','public.crm_import_candidates_atomic(uuid,uuid,jsonb)','EXECUTE')
    OR has_function_privilege('service_role','public.crm_import_candidates_atomic(uuid,uuid,jsonb)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.crm_import_candidates_atomic(uuid,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Atomic import grant or private ledger isolation incorrect'; END IF;
END $build53_acl$;
SET ROLE authenticated;
DO $build53_user_cases$
DECLARE
 v_req uuid:='99999999-9999-4999-8999-999999999991';
 v_rows jsonb:='[
  {"full_name":"Batch Synthetic One","email":"batch53-one@example.invalid"},
  {"full_name":"Batch Synthetic Two","mobile":"9199999910"}
 ]'::jsonb;
 v_response jsonb;
 v_replay jsonb;
 v_count integer;
 v_before integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 BEGIN
  PERFORM public.crm_import_candidates_atomic(v_req,
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',v_rows);
  RAISE EXCEPTION 'Recruiter was permitted to import';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
 BEGIN
  PERFORM public.crm_import_candidates_atomic(v_req,
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',v_rows);
  RAISE EXCEPTION 'Pending account was permitted to import';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
 BEGIN
  PERFORM public.crm_import_candidates_atomic(v_req,
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',v_rows);
  RAISE EXCEPTION 'Suspended admin was permitted to import';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 v_response:=public.crm_import_candidates_atomic(v_req,
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',v_rows);
 IF v_response->>'status'<>'created'
    OR (v_response->>'count')::integer<>2
    OR jsonb_array_length(v_response->'candidate_ids')<>2 THEN
    RAISE EXCEPTION 'Initial atomic import failed: %',v_response; END IF;
 v_replay:=public.crm_import_candidates_atomic(v_req,
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',v_rows);
 IF v_replay->>'status'<>'replayed'
    OR v_replay->'candidate_ids'<>v_response->'candidate_ids' THEN
    RAISE EXCEPTION 'Unknown-commit idempotent replay failed'; END IF;
 BEGIN
  PERFORM public.crm_import_candidates_atomic(v_req,
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '[{"full_name":"Changed","email":"different@example.invalid"}]'::jsonb);
  RAISE EXCEPTION 'Modified payload reused committed key';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM public.crm_import_candidates_atomic(v_req,
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',v_rows);
  RAISE EXCEPTION 'Modified assignee reused committed key';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '99999999-9999-4999-8999-999999999992',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '[{"full_name":"Already imported","email":"batch53-one@example.invalid"}]'::jsonb);
  RAISE EXCEPTION 'Existing candidate identity conflict accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '99999999-9999-4999-8999-999999999993',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '[{"full_name":"Within 1","email":"repeat@example.invalid"},
     {"full_name":"Within 2","email":"REPEAT@example.invalid"}]'::jsonb);
  RAISE EXCEPTION 'Within-file duplicate identity accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '99999999-9999-4999-8999-999999999994',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '[{"full_name":"First should roll back","email":"rollback53@example.invalid"},
     {"full_name":"Second invalid","email":"error53@example.invalid","experience_years":-99}]'::jsonb);
  RAISE EXCEPTION 'Invalid row two did not abort entire batch';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '99999999-9999-4999-8999-999999999995',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '[{"full_name":"Blocked stage","email":"stage53@example.invalid","stage":"joined"}]'::jsonb);
  RAISE EXCEPTION 'Privileged stage injection accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '99999999-9999-4999-8999-999999999996',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '[{"full_name":"Missing identity"}]'::jsonb);
  RAISE EXCEPTION 'Candidate without email/mobile accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '99999999-9999-4999-8999-999999999997',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',v_rows);
  RAISE EXCEPTION 'Pending recruiter assignment accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT count(*) INTO v_before FROM public.candidates;
 PERFORM set_config('build52.fail_audit','on',true);
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '99999999-9999-4999-8999-999999999998',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '[{"full_name":"Audit rollback","email":"audit53@example.invalid"}]'::jsonb);
  RAISE EXCEPTION 'Injected candidate audit error did not abort import';
 EXCEPTION WHEN SQLSTATE 'P9012' THEN NULL; END;
 PERFORM set_config('build52.fail_audit','off',true);
 SELECT count(*) INTO v_count FROM public.candidates;
 IF v_count<>v_before THEN RAISE EXCEPTION 'Candidate persisted after audit failure'; END IF;
END $build53_user_cases$;
RESET ROLE;
DO $build53_owner_cases$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM crm_private.candidate_import_batches;
 IF n<>1 THEN RAISE EXCEPTION 'Expected exactly one batch ledger, got %',n; END IF;
 SELECT count(*) INTO n FROM public.candidates WHERE email IN
 ('batch53-one@example.invalid','rollback53@example.invalid',
  'audit53@example.invalid','stage53@example.invalid');
 IF n<>1 THEN RAISE EXCEPTION 'Invalid or rolled-back candidate persisted: %',n; END IF;
 SELECT count(*) INTO n FROM public.candidates WHERE
  mobile='9199999910' AND assigned_recruiter='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND stage='lead_received';
 IF n<>1 THEN RAISE EXCEPTION 'Second valid candidate missing'; END IF;
 SELECT count(*) INTO n FROM public.audit_logs
  WHERE action='crm_candidate_batch_create';
 IF n<>1 THEN RAISE EXCEPTION 'Batch audit wrote unexpected events: %',n; END IF;
 IF EXISTS(SELECT 1 FROM public.audit_logs WHERE action='crm_candidate_batch_create'
  AND details::text LIKE '%batch53-one@example.invalid%') THEN
  RAISE EXCEPTION 'Contact PII leaked into batch audit'; END IF;
 IF EXISTS(SELECT 1 FROM public.billing)
 THEN RAISE EXCEPTION 'Auto-billing triggered from create-only import'; END IF;
 -- An active candidate workflow-rule would bypass this fixed-scope API.
 INSERT INTO public.workflow_rules(table_name,is_active) VALUES('candidates',true);
END $build53_owner_cases$;
SET ROLE authenticated;
DO $build53_rule_guard$
BEGIN
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '99999999-9999-4999-8999-999999999999',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '[{"full_name":"Would trigger workflow","email":"workflow53@example.invalid"}]'::jsonb);
  RAISE EXCEPTION 'Candidate import bypassed active workflow-rule hold';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $build53_rule_guard$;
RESET ROLE;
DELETE FROM public.workflow_rules WHERE table_name='candidates';
SET ROLE anon;
DO $build53_anon$
BEGIN
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '99999999-9999-4999-8999-999999999999',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','[]'::jsonb);
  RAISE EXCEPTION 'Anonymous role executed candidate import RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $build53_anon$;
RESET ROLE;
