// Build53: full 67-policy replay -> 35 restrictive replacement -> audited
// Build52 candidate writes -> Build53 import RPC. All inside one rollback.
import {readFileSync,writeFileSync} from "node:fs";
const prior=readFileSync("security/build49/67-policy-admin-profile-compat.integration.sql","utf8");
const writeRpc=readFileSync("security/build52/candidate-write-rpc-review-only.sql","utf8");
const importRpc=readFileSync("security/build53/atomic-import-rpc-review-only.sql","utf8");
const anchor="-- Build49: Account management and self-profile compatibility AFTER the full";
const finish="RESET ROLE;\nSET ROLE anon;";
if(prior.split(anchor).length!==2||prior.split(finish).length!==2
 ||!prior.includes("Expected exactly 35 new approved-for-review policies")
 ||!prior.includes("\nROLLBACK;"))
 throw new Error("67-policy fixture changed; refuse to run a partial replay");
const before=`
ALTER TABLE public.candidates ALTER COLUMN id SET DEFAULT gen_random_uuid();
UPDATE public.candidates SET updated_at=clock_timestamp() WHERE updated_at IS NULL;
`+writeRpc+"\n"+importRpc;
const cases=`
-- Build53 full policy security integration under synthetic signed role.
DO $b53_full$
DECLARE receipt jsonb; again jsonb; count_a integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 BEGIN
  PERFORM public.crm_import_candidates_atomic(
   '88888888-8888-4888-8888-888888888881',
   '11111111-1111-4111-8111-111111111111',
   '[{"full_name":"Recruiter should fail","email":"denied53@example.invalid"}]'::jsonb);
  RAISE EXCEPTION 'Full-policy recruiter imported candidate';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 receipt:=public.crm_import_candidates_atomic(
   '88888888-8888-4888-8888-888888888882',
   '11111111-1111-4111-8111-111111111111',
   '[{"full_name":"Full policy batch","email":"full53@example.invalid"}]'::jsonb);
 again:=public.crm_import_candidates_atomic(
   '88888888-8888-4888-8888-888888888882',
   '11111111-1111-4111-8111-111111111111',
   '[{"full_name":"Full policy batch","email":"full53@example.invalid"}]'::jsonb);
 IF receipt->>'status'<>'created' OR again->>'status'<>'replayed'
   OR again->'candidate_ids'<>receipt->'candidate_ids' THEN
   RAISE EXCEPTION 'Full policy idempotent create/replay failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.candidates WHERE email='full53@example.invalid'
   AND stage IS DISTINCT FROM 'lead_received'::public.candidate_stage) THEN
   RAISE EXCEPTION 'Imported candidate stage was not the default'; END IF;
 IF has_table_privilege('authenticated','public.candidates','INSERT')
  OR has_column_privilege('authenticated','public.candidates','stage','UPDATE')
 THEN RAISE EXCEPTION 'Full policy direct browser DML bypass'; END IF;
 SELECT count(*) INTO count_a FROM public.audit_logs WHERE action='crm_candidate_batch_create';
 IF count_a<>1 THEN RAISE EXCEPTION 'Expected single batch audit, got %',count_a; END IF;
END $b53_full$;
`;
const combined=prior.replace(anchor,()=>before+"\n"+anchor)
                    .replace(finish,()=>cases+finish);
writeFileSync("/tmp/build53-full-67-policy-atomic-import.integration.sql",combined);
process.stdout.write("Build53 full 67-policy atomic import replay prepared\n");
