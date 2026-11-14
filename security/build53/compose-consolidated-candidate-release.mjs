// Build53 integration of exact original 67-policy replacement AND all
// candidate RPCs in ONE disposable rollback-only PostgreSQL transaction.
import {readFileSync,writeFileSync} from "node:fs";
const baseline=readFileSync("security/build49/67-policy-admin-profile-compat.integration.sql","utf8");
const stage=readFileSync("security/build51/candidate-stage-rpc-review-only.sql","utf8");
const write=readFileSync("security/build52/candidate-write-rpc-review-only.sql","utf8");
const atomic=readFileSync("security/build53/atomic-import-rpc-review-only.sql","utf8");
const cases=readFileSync("security/build53/consolidated-cases.sql","utf8");
const anchor="-- Build49: Account management and self-profile compatibility AFTER the full";
const finish="RESET ROLE;\nSET ROLE anon;";
if(baseline.split(anchor).length!==2||baseline.split(finish).length!==2
 ||!baseline.includes("Expected exactly 35 new approved-for-review policies")
 ||!baseline.includes("\nROLLBACK;")) throw new Error("Exact policy replay drift");
const patches=`
ALTER TABLE public.candidates ALTER COLUMN id SET DEFAULT gen_random_uuid();
UPDATE public.candidates SET updated_at=clock_timestamp() WHERE updated_at IS NULL;
UPDATE public.candidates SET stage='lead_received'
 WHERE stage IS NULL;
`+stage+"\n"+write+"\n"+atomic;
const merged=baseline.replace(anchor,()=>patches+"\n"+anchor)
 .replace(finish,()=>cases+"\n"+finish);
writeFileSync("/tmp/build53-consolidated-candidate-release.integration.sql",merged);
process.stdout.write("Built Build53 joined stage/detail/atomic import candidate replay\n");
