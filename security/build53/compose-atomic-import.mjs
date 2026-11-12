// Build53: compose a single rollback-only transaction using the existing
// Build52 live-trigger-shaped fixture, without creating hosted Auth identities.
import { readFileSync, writeFileSync } from "node:fs";
const fixture=readFileSync("security/build52/candidate-write.integration.sql","utf8");
const writeRpc=readFileSync("security/build52/candidate-write-rpc-review-only.sql","utf8");
const importRpc=readFileSync("security/build53/atomic-import-rpc-review-only.sql","utf8");
const cases=readFileSync("security/build53/atomic-import-cases.sql","utf8");
const include="\\ir candidate-write-rpc-review-only.sql";
const tail="ROLLBACK;\nSELECT 'PASS Build52";
if(fixture.split(include).length!==2 || fixture.split(tail).length!==2)
 throw new Error("Build52 fixture drift; release contract must be reviewed");
const combined=fixture.replace(include,()=>writeRpc+"\n"+importRpc)
 .replace(tail,()=>cases+"\n"+tail);
writeFileSync("/tmp/build53-candidate-atomic-import.integration.sql",combined);
process.stdout.write("Build53 disposable candidate import matrix prepared\n");
