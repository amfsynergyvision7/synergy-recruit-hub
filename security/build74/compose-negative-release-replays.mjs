/**
 * Build74: two deliberately failing, non-deployable fault injections into the
 * already protected combined rollback rehearsal. We never touch the guarded
 * Build54 source or its original /tmp generated source. Execute only against
 * CI's disposable PostgreSQL instance with an expected postflight failure.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {combinedFixture} from "./compose-postrelease-permission-check.mjs";

const cases=Object.freeze([
 ["anonymous_candidate_rpc","GRANT EXECUTE ON FUNCTION public.crm_import_candidates_atomic(uuid,uuid,jsonb) TO anon;"],
 ["anonymous_table_truncate","GRANT TRUNCATE ON public.candidates TO anon;"]
]);
const anchor="SET LOCAL amf.build74_rehearsal='approved_disposable_only';";
const fail=s=>{throw new Error("BUILD74 NEGATIVE RELEASE CASE REFUSED: "+s)};
export function composeNegative(source,statement){
 if(source.split(anchor).length!==2 ||
    (source.match(/^BEGIN;$/gm)||[]).length!==1 ||
    (source.match(/^ROLLBACK;$/gm)||[]).length!==1 ||
    (source.match(/^COMMIT;$/gm)||[]).length!==0 ||
    !source.includes("CREATE TEMP VIEW b74_review_permissions") ||
    !source.includes("Build74 22-function permission postflight failed"))
  fail("Positive combined source shape/fingerprint guard drift");
 if(!cases.some(([,sql])=>sql===statement))fail("Unexpected fault injection");
 const value=source.replace(anchor,statement+"\n"+anchor);
 if((value.match(/^ROLLBACK;$/gm)||[]).length!==1 ||
    (value.match(/^BEGIN;$/gm)||[]).length!==1)
  fail("Fault injection changed transaction boundaries");
 return value;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const src=readFileSync(combinedFixture,"utf8");
 const paths=[];
 for(const [name,statement] of cases){
  const path="/tmp/build54-release-review/build74-negative-"+name+".integration.sql";
  writeFileSync(path,composeNegative(src,statement));
  paths.push({case:name,path,expected_failure:"Build74 22-function permission postflight failed"});
 }
 process.stdout.write(JSON.stringify({build:74,mode:"DISPOSABLE_EXPECTED_FAILURE_ONLY",cases:paths,deployable:false})+"\n");
}
