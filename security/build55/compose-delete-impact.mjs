// Synthetic PG17 postgreSQL test: reuse Build52 source-shaped role/legacy trigger
// and extend with candidate FK CASCADE/SET NULL impact checks. ROLLBACK only.
import {readFileSync,writeFileSync} from "node:fs";
const f=readFileSync("security/build52/candidate-write.integration.sql","utf8");
const write=readFileSync("security/build52/candidate-write-rpc-review-only.sql","utf8");
const assessment=readFileSync("security/build55/candidate-delete-impact-review-only.sql","utf8");
const setup=readFileSync("security/build55/candidate-fk-fixture.sql","utf8");
const cases=readFileSync("security/build55/candidate-delete-impact-cases.sql","utf8");
const include="\\ir candidate-write-rpc-review-only.sql";
const end="ROLLBACK;\nSELECT 'PASS Build52";
if(f.split(include).length!==2||f.split(end).length!==2)
 throw new Error("Build52 fixture changed: fail closed");
const combined=f.replace(include,()=>write+"\n"+assessment)
 .replace(end,()=>setup+"\n"+cases+"\n"+end);
if((combined.match(/^ROLLBACK;$/gm)||[]).length!==1||
   (combined.match(/^COMMIT;$/gm)||[]).length!==0)
 throw new Error("Candidate deletion assessment test would persist changes");
writeFileSync("/tmp/build55-candidate-delete-impact.integration.sql",combined);
process.stdout.write("Build55 isolated deletion impact and cascade trap prepared\n");
