-- BUILD53: consolidated candidate stage + detail + import contracts under
-- full 67 original policy replay and 35 restrictive replacement.
-- This is synthetic, executed in ONE rollback-only transaction.
SET ROLE authenticated;
DO $build53_combined$
DECLARE
  receipt jsonb;
  again jsonb;
  candidate_id uuid;
  t0 timestamptz;
  t1 timestamptz;
  owned int;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 receipt:=public.crm_import_candidates_atomic(
  '77777777-7777-4777-8777-777777777771',
  '11111111-1111-4111-8111-111111111111',
  '[{"full_name":"Consolidated Synthetic","email":"combined53@example.invalid"}]'::jsonb
 );
 IF receipt->>'status'<>'created' OR (receipt->>'count')::int<>1
 THEN RAISE EXCEPTION 'Combined import failed'; END IF;
 candidate_id:=(receipt->'candidate_ids'->>0)::uuid;
 SELECT count(*) INTO owned FROM public.candidates WHERE id=candidate_id
  AND assigned_recruiter='11111111-1111-4111-8111-111111111111'
  AND stage='lead_received';
 IF owned<>1 THEN RAISE EXCEPTION 'Combined create ownership/stage invalid'; END IF;
 SELECT updated_at INTO t0 FROM public.candidates WHERE id=candidate_id;
 IF public.crm_change_candidate_stage(candidate_id,'lead_received','contacted')<>'contacted'
 THEN RAISE EXCEPTION 'Combined stage change failed'; END IF;
 SELECT updated_at INTO t1 FROM public.candidates WHERE id=candidate_id;
 IF t1<=t0 THEN RAISE EXCEPTION 'Stage transition did not advance version'; END IF;
 BEGIN
  PERFORM public.crm_change_candidate_stage(candidate_id,'lead_received','interested');
  RAISE EXCEPTION 'Expected stage was ignored';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 BEGIN
  PERFORM public.crm_change_candidate_stage(candidate_id,'contacted','joined');
  RAISE EXCEPTION 'Side-effecting joined stage accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF public.crm_write_candidate(candidate_id,t1,'{"notes":"safe edit"}'::jsonb)<>candidate_id
 THEN RAISE EXCEPTION 'Combined safe profile edit rejected'; END IF;
 BEGIN
  PERFORM public.crm_write_candidate(candidate_id,t1,'{"notes":"stale edit"}'::jsonb);
  RAISE EXCEPTION 'Stale profile update accepted after prior edit';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 again:=public.crm_import_candidates_atomic(
  '77777777-7777-4777-8777-777777777771',
  '11111111-1111-4111-8111-111111111111',
  '[{"full_name":"Consolidated Synthetic","email":"combined53@example.invalid"}]'::jsonb
 );
 IF again->>'status'<>'replayed'
 OR (again->'candidate_ids'->>0)::uuid<>candidate_id
 THEN RAISE EXCEPTION 'Combined import replay duplicated candidate'; END IF;
 BEGIN
   UPDATE public.candidates SET stage='joined' WHERE id=candidate_id;
   RAISE EXCEPTION 'Direct stage UPDATE survived candidate revocations';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_column_privilege('authenticated','public.candidates','stage','UPDATE')
 OR has_table_privilege('authenticated','public.candidates','INSERT')
 OR has_table_privilege('authenticated','public.candidates','DELETE')
 THEN RAISE EXCEPTION 'Candidate browser bypass survived migration'; END IF;
END $build53_combined$;
RESET ROLE;
DO $build53_combined_owner$
DECLARE candidate_id uuid; n integer;
BEGIN
 SELECT candidate_ids[1] INTO candidate_id
 FROM crm_private.candidate_import_batches
 WHERE request_id='77777777-7777-4777-8777-777777777771';
 IF candidate_id IS NULL THEN RAISE EXCEPTION 'Combined import ledger absent'; END IF;
 SELECT count(*) INTO n FROM public.candidates
  WHERE id=candidate_id AND stage='contacted' AND notes='safe edit';
 IF n<>1 THEN RAISE EXCEPTION 'Combined final candidate state incorrect'; END IF;
 SELECT count(*) INTO n FROM public.audit_logs WHERE record_id=candidate_id::text
  AND action IN('crm_candidate_create','crm_candidate_stage_change','crm_candidate_update');
 IF n<>3 THEN RAISE EXCEPTION 'Combined candidate audit count incorrect: %',n; END IF;
 SELECT count(*) INTO n FROM public.audit_logs
  WHERE action='crm_candidate_batch_create'
  AND record_id='77777777-7777-4777-8777-777777777771';
 IF n<>1 THEN RAISE EXCEPTION 'Batch audit missing or repeated'; END IF;
 -- The test's original synthetic billing row must stay isolated.
 IF EXISTS(SELECT 1 FROM public.billing b WHERE b.candidate_uuid=candidate_id)
 THEN RAISE EXCEPTION 'A synthetic candidate triggered financial billing'; END IF;
END $build53_combined_owner$;
