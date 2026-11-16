import {readFileSync,writeFileSync} from "node:fs";
const base=readFileSync("security/build40/19-table-13-view-source-shaped.integration.sql","utf8");
const review=readFileSync("security/build59/13-view-write-acl-review-only.sql","utf8");
const marker="ROLLBACK;\nSELECT 'PASS: exact source 19-table 13-view";
if(base.split(marker).length!==2 || !base.includes("ALTER VIEW public.vw_submission_filters SET (security_invoker=true)") || !review.includes("DO $b59_views_postflight$"))
 throw new Error("Build59 standalone view source drift; refuse integration");
const withSyntheticRoles=base.replace("BEGIN;\n",`BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
`);
const combined=withSyntheticRoles.replace(marker,()=>review+"\n"+marker);
if((combined.match(/^BEGIN;$/gm)||[]).length!==1 ||
   (combined.match(/^ROLLBACK;$/gm)||[]).length!==1 ||
   (combined.match(/^COMMIT;$/gm)||[]).length!==0)
 throw new Error("Build59 full rollback-only requirement violated");
writeFileSync("/tmp/build59-13-view-security.integration.sql",combined);
process.stdout.write("Build59 13-view source-shaped ACL rollback fixture prepared\n");
