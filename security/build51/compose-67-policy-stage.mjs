// Build51: compose a fresh isolated replay of the *original* 67 production
// RLS policies and the 35 replacement policies, then layer the candidate
// stage RPC. No hosted DB is touched; PostgreSQL fixture ends with ROLLBACK.
import { readFileSync, writeFileSync } from "node:fs";
const prior = readFileSync("security/build49/67-policy-admin-profile-compat.integration.sql","utf8");
const patch = readFileSync("security/build51/candidate-stage-rpc-review-only.sql","utf8");
const anchor = "-- Build49: Account management and self-profile compatibility AFTER the full";
const finish = "RESET ROLE;\nSET ROLE anon;";
if (prior.split(anchor).length !== 2 || prior.split(finish).length !== 2 ||
    !prior.includes("\nROLLBACK;") ||
    !prior.includes("Expected exactly 35 new approved-for-review policies")) {
  throw new Error("Build49 full replay drifted; do not silently skip stage integration");
}
const preflight = `
 -- Build51: full 67-to-35 RLS fixture is in effect before this fragment.
 -- Original synthetic candidates have no stage default; initialize owner-side.
 UPDATE public.candidates SET stage='lead_received'
 WHERE id IN ('11111111-1111-4111-8111-111111111111',
              '22222222-2222-4222-8222-222222222222');
` + patch;
const cases = `
 -- Build51: full-policy compatibility — signed-subject simulation ONLY.
 DO $b51full$
 DECLARE n integer;
 BEGIN
   -- Stage column cannot be changed by an authenticated browser even if its
   -- own candidate row satisfies RLS; all stage writes require the RPC.
   IF has_column_privilege('authenticated','public.candidates','stage','UPDATE')
   THEN RAISE EXCEPTION 'Legacy browser stage grant survived Build51'; END IF;
   PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
   BEGIN
     UPDATE public.candidates SET stage='joined'
      WHERE id='11111111-1111-4111-8111-111111111111';
     RAISE EXCEPTION 'Direct stage UPDATE bypassed column grant';
   EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   IF public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111',
       'lead_received','contacted') <> 'contacted'
   THEN RAISE EXCEPTION 'Approved owner recruiter cannot transition'; END IF;
   BEGIN
     PERFORM public.crm_change_candidate_stage('22222222-2222-4222-8222-222222222222',
       'lead_received','contacted');
     RAISE EXCEPTION 'Cross-recruiter stage change allowed';
   EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN
     PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111',
       'lead_received','interested');
     RAISE EXCEPTION 'Stale old-stage accepted';
   EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
   BEGIN
     PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111',
       'contacted','joined');
     RAISE EXCEPTION 'Billing-triggering transition was allowed';
   EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   PERFORM set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
   BEGIN
     PERFORM public.crm_change_candidate_stage('11111111-1111-4111-8111-111111111111',
       'contacted','selected');
     RAISE EXCEPTION 'Inactive recruiter action allowed';
   EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
   IF public.crm_change_candidate_stage('22222222-2222-4222-8222-222222222222',
      'lead_received','interested') <> 'interested'
   THEN RAISE EXCEPTION 'Approved administrator override rejected'; END IF;
   SELECT count(*) INTO n FROM public.audit_logs
    WHERE action='crm_candidate_stage_change';
   IF n<>2 THEN RAISE EXCEPTION 'Build51 audit entries missing: %',n; END IF;
 END $b51full$;
`;
const combined = prior.replace(anchor,preflight+"\n"+anchor).replace(finish,cases+finish);
const output="/tmp/build51-full-67-policy-stage.integration.sql";
writeFileSync(output,combined);
process.stdout.write("Composed isolated Build51 full 67-to-35 replacement + narrow stage RPC transaction; "+combined.length+" chars\\n");
