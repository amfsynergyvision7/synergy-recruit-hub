/**
 * Build74: validate the combined Build54 synthetic migration against its real
 * post-release 22-function scope (16 legacy + 6 reviewed CRM SECURITY DEFINER RPCs).
 * Never creates deployable SQL or contacts a hosted database.
 */
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const read=p=>readFileSync(resolve(root,p),"utf8");
const digest=s=>createHash("sha256").update(s).digest("hex");
const fail=s=>{throw new Error("BUILD74 POSTRELEASE REHEARSAL REFUSED: "+s)};
const count=(s,re)=>(s.match(re)||[]).length;
export const approvedRpcs=Object.freeze([
 ["public.crm_admin_manage_user(uuid,text,text)","security/build49/67-policy-plus-account-rpcs-review-only.sql","crm_admin_manage_user"],
 ["public.crm_update_own_profile(text,text,text)","security/build49/67-policy-plus-account-rpcs-review-only.sql","crm_update_own_profile"],
 ["public.crm_change_candidate_stage(uuid,text,text)","security/build51/candidate-stage-rpc-review-only.sql","crm_change_candidate_stage"],
 ["public.crm_write_candidate(uuid,timestamptz,jsonb)","security/build52/candidate-write-rpc-review-only.sql","crm_write_candidate"],
 ["public.crm_import_candidates_atomic(uuid,uuid,jsonb)","security/build53/atomic-import-rpc-review-only.sql","crm_import_candidates_atomic"],
 ["public.crm_candidate_delete_impact(uuid)","security/build55/candidate-delete-impact-review-only.sql","crm_candidate_delete_impact"],
]);
export const originalFixture="/tmp/build54-release-review/full-release-rollback.integration.sql";
export const combinedFixture="/tmp/build54-release-review/build74-22-function-rollback.integration.sql";
function replaceExactlyOnce(source,from,to){
 if(source.split(from).length!==2)fail("Anchor unexpectedly absent or repeated: "+from.slice(0,65));
 return source.replace(from,to);
}
export function buildPostflight(base,sourceByPath){
 if(count(base,/^WITH expected_tables\(name\) AS \(VALUES/gm)!==1 ||
    count(base,/^  \('public\.[a-z_]+\([^']*\)'\)/gm)!==16)
  fail("Build73 preflight legacy function signature scope drift");
 for(const [sig,p,name] of approvedRpcs){
  const source=sourceByPath[p];
  if(!source ||
     !source.includes("CREATE OR REPLACE FUNCTION public."+name+"(") ||
     !source.includes("GRANT EXECUTE ON FUNCTION "+sig))
    fail("Reviewed source or authenticated EXECUTE missing for "+sig);
  const start=source.indexOf("CREATE OR REPLACE FUNCTION public."+name+"(");
  const next=source.indexOf("CREATE OR REPLACE FUNCTION public.",start+12);
  if(!source.slice(start,next<0?undefined:next).includes("SECURITY DEFINER"))
   fail("Expected source SECURITY DEFINER missing for "+name);
 }
 const sign=approvedRpcs.map(x=>x[0]);
 if(new Set(sign).size!==6)fail("Duplicate approved CRM signature");
 let result=replaceExactlyOnce(base,"\n), tab AS (",
   ",\n"+sign.map(x=>"  ('"+x+"')").join(",\n")+"\n), tab AS (");
 for(const [a,b] of [
  ["matched_privileged_functions=16","matched_privileged_functions=22"],
  ["actual_privileged_functions=16","actual_privileged_functions=22"],
  ["authenticated_executable_functions=3","authenticated_executable_functions=9"]
 ])result=replaceExactlyOnce(result,a,b);
 if(count(result,/^  \('public\.[a-z_]+\([^']*\)'\)/gm)!==22)
  fail("Expected 22 source-pinned function signatures");
 const query=result.replace(/^\s*--.*$/gm,"").trim().replace(/;\s*$/,"");
 const checks=sign.map(x=>
   " IF NOT has_function_privilege('authenticated','"+x+"','EXECUTE') OR\n"+
   "    has_function_privilege('anon','"+x+"','EXECUTE') THEN\n"+
   "    RAISE EXCEPTION 'Build74 incorrect authenticated-only RPC grant: "+x+"'; END IF;"
 ).join("\n");
 return [
  "-- Build74 permission-only postflight under already-open disposable transaction.",
  "DO $b74_guard$",
  "BEGIN",
  " IF current_setting('amf.build74_rehearsal',true) IS DISTINCT FROM 'approved_disposable_only' THEN",
  " RAISE EXCEPTION 'Build74 refuses execution outside synthetic migration rehearsal'; END IF;",
  "END $b74_guard$;",
  "CREATE TEMP VIEW b74_review_permissions AS",
  query+";",
  "DO $b74_postflight$",
  "DECLARE p record; policy_count integer;",
  "BEGIN",
  " SELECT * INTO p FROM b74_review_permissions;",
  " IF p.permissions_gate IS DISTINCT FROM 'PERMISSIONS_POSTFLIGHT_PASS_NOT_A_RELEASE_APPROVAL'",
  " OR p.matched_tables<>19 OR p.matched_views<>13",
  " OR p.matched_privileged_functions<>22 OR p.actual_privileged_functions<>22",
  " OR p.anon_truncate_tables<>0 OR p.authenticated_truncate_tables<>0",
  " OR p.invoker_views<>13 OR p.anonymous_readable_views<>0",
  " OR p.anonymous_executable_functions<>0 OR p.public_executable_functions<>0",
  " OR p.authenticated_executable_functions<>9 THEN",
  " RAISE EXCEPTION 'Build74 22-function permission postflight failed: %',row_to_json(p); END IF;",
  " SELECT count(*) INTO policy_count FROM pg_catalog.pg_policies WHERE schemaname='public';",
  " IF policy_count<>35 THEN",
  " RAISE EXCEPTION 'Build74 policy replacement expected exactly 35, found %',policy_count; END IF;",
  checks,
  " RAISE NOTICE 'PASS Build74 19-table 13-view 22-function 35-policy combined postflight';",
  "END $b74_postflight$;",
  "DROP VIEW b74_review_permissions;",
  ""
 ].join("\n");
}
export function compose(source,postflight){
 if(count(source,/^BEGIN;$/gm)!==1 ||
    count(source,/^ROLLBACK;$/gm)!==1 ||
    count(source,/^COMMIT;$/gm)!==0)
  fail("Build54 original fixture must have exactly one BEGIN/ROLLBACK and zero COMMIT");
 if(!source.includes("crm_import_candidates_atomic") ||
    !source.includes("zz_crm_billing_write_hold") ||
    !source.includes("Expected 35 restricted RLS policies"))
  fail("Combined fixture missing guarded candidate, finance or 35-policy anchors");
 const marker="\nROLLBACK;\n";
 const after="\nSET LOCAL amf.build74_rehearsal='approved_disposable_only';\n"+
   postflight+"\nROLLBACK;\n";
 const generated=replaceExactlyOnce(source,marker,after);
 if(count(generated,/^BEGIN;$/gm)!==1 ||
    count(generated,/^ROLLBACK;$/gm)!==1 ||
    count(generated,/^COMMIT;$/gm)!==0)fail("Build74 must remain rollback-only");
 return generated;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const base=read("security/build73/48-object-release-preflight.readonly.sql");
 const sources=Object.fromEntries(approvedRpcs.map(x=>[x[1],read(x[1])]));
 const postflight=buildPostflight(base,sources);
 const original=readFileSync(originalFixture,"utf8");
 const combined=compose(original,postflight);
 writeFileSync(combinedFixture,combined);
 process.stdout.write(JSON.stringify({
  build:74,source_state:"NONPROD_ROLLBACK_ONLY",legacy_privileged_functions:16,
  additional_approved_definer_rpcs:6,privileged_postrelease_total:22,
  expected_authenticated_exec_count:9,
  original_sha256:digest(original),postflight_sha256:digest(postflight),
  combined_sha256:digest(combined),combined_bytes:combined.length,
  output_path:combinedFixture,deployable:false
 })+"\n");
}
