// Build52 exact source-shaped replay (synthetic transaction, NO hosted writes).
// Inject candidate write RPC after Build49's complete 67 -> 35 policy swap.
import {readFileSync,writeFileSync} from "node:fs";
const prior=readFileSync("security/build49/67-policy-admin-profile-compat.integration.sql","utf8");
const patch=readFileSync("security/build52/candidate-write-rpc-review-only.sql","utf8");
const anchor="-- Build49: Account management and self-profile compatibility AFTER the full";
const finish="RESET ROLE;\nSET ROLE anon;";
if(prior.split(anchor).length!==2||prior.split(finish).length!==2
 ||!prior.includes("Expected exactly 35 new approved-for-review policies")
 ||!prior.includes("\nROLLBACK;")) {
 throw new Error("Live 67-policy replay fixture drift: refuse to skip full lockdown");
}
const before=`
-- Build52 requires an id default in the synthetic no-default source-shaped
-- table; production already has gen_random_uuid() per read-only catalog.
ALTER TABLE public.candidates ALTER COLUMN id SET DEFAULT gen_random_uuid();
UPDATE public.candidates SET updated_at=clock_timestamp() WHERE updated_at IS NULL;
`+patch;
const cases=`
-- Build52 full 67-policy to 35-policy compatibility, synthetic JWT subjects.
DO $b52_full$
DECLARE id_new uuid; previous timestamptz; a_count integer;
BEGIN
 IF has_table_privilege('authenticated','public.candidates','INSERT')
    OR has_table_privilege('authenticated','public.candidates','UPDATE')
    OR has_table_privilege('authenticated','public.candidates','DELETE')
 THEN RAISE EXCEPTION 'Direct table DML still available after Build52 lockdown'; END IF;
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 BEGIN
  INSERT INTO public.candidates(full_name) VALUES('Blocked direct INSERT');
  RAISE EXCEPTION 'Direct insert bypassed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 id_new:=public.crm_write_candidate(NULL,NULL,
   '{"full_name":"Synthetic with full policy","email":"safe@example.invalid"}'::jsonb);
 IF id_new IS NULL THEN RAISE EXCEPTION 'RPC create returned no UUID'; END IF;
 SELECT updated_at INTO previous FROM public.candidates WHERE id=id_new;
 IF public.crm_write_candidate(id_new,previous,'{"notes":"Allowlisted notes"}'::jsonb)<>id_new
 THEN RAISE EXCEPTION 'Owner edit failed under full RLS lockdown'; END IF;
 BEGIN
  PERFORM public.crm_write_candidate('22222222-2222-4222-8222-222222222222',
    (SELECT updated_at FROM public.candidates WHERE id='22222222-2222-4222-8222-222222222222'),
    '{"notes":"Cross-owner"}'::jsonb);
  RAISE EXCEPTION 'Cross-owner write succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Risk","stage":"joined"}'::jsonb);
  RAISE EXCEPTION 'Stage bypass succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 BEGIN
  PERFORM public.crm_write_candidate(NULL,NULL,'{"full_name":"Inactive"}'::jsonb);
  RAISE EXCEPTION 'Inactive create succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 IF public.crm_write_candidate(NULL,NULL,
    '{"full_name":"Admin safe create","assigned_recruiter":"22222222-2222-4222-8222-222222222222"}'::jsonb)
 IS NULL THEN RAISE EXCEPTION 'Admin create failed'; END IF;
 SELECT count(*) INTO a_count FROM public.audit_logs WHERE action IN
    ('crm_candidate_create','crm_candidate_update');
 IF a_count<>3 THEN RAISE EXCEPTION 'Expected three candidate audit records, got %',a_count; END IF;
END $b52_full$;
`;
// Use replacer functions: SQL regex literals can contain "
const output="/tmp/build52-full-policy-candidate-write.integration.sql";
writeFileSync(output,composed);
process.stdout.write("Composed Build52 full 67 -> 35 policy transaction with candidate RPC and assertions\n");
" and MUST NOT
// be interpreted by JavaScript as String.replace suffix substitutions.
const composed=prior.replace(anchor,()=>before+"\n"+anchor)
                    .replace(finish,()=>cases+finish);
const output="/tmp/build52-full-policy-candidate-write.integration.sql";
writeFileSync(output,composed);
process.stdout.write("Composed Build52 full 67 -> 35 policy transaction with candidate RPC and assertions\n");
