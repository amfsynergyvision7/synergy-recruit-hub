// Build57: compose exact-source Build56 synthetic joined double-billing
// fixture + blocking invoice ACL/BEFORE triggers. One ROLLBACK only.
import {readFileSync,writeFileSync} from "node:fs";
const base=readFileSync("security/build56/production-financial-source.integration.sql","utf8");
const guard=readFileSync("security/build57/billing-write-lockdown-review-only.sql","utf8");
const cases=readFileSync("security/build57/billing-lockdown-cases.sql","utf8");
const anchor="DO $b56_guard_assertions$";
const end="ROLLBACK;\nSELECT 'PASS Build56:";
if(base.split(anchor).length!==2 || base.split(end).length!==2
  ||!base.includes("DO $b56_legacy_double_billing$")
  ||!guard.includes("CREATE TRIGGER zz_crm_billing_truncate_hold"))
 throw new Error("Build56 source baseline drift; refuse Build57 rehearsal");
const fixture=base.replace(anchor,()=>`
-- Reproduce the original risky 3-API-role grants within disposable fixture.
GRANT ALL ON public.billing TO anon,authenticated,service_role;
`+guard+"\n"+anchor)
 .replace(end,()=>cases+"\n"+end);
if((fixture.match(/^BEGIN;$/gm)||[]).length!==1
  ||(fixture.match(/^ROLLBACK;$/gm)||[]).length!==1
  ||(fixture.match(/^COMMIT;$/gm)||[]).length!==0)
 throw new Error("Build57 fixture is not exactly one transaction/rollback");
writeFileSync("/tmp/build57-billing-lockdown.integration.sql",fixture);
process.stdout.write("Build57 billing ACL and owner-definer trigger hold rehearsal prepared\n");
