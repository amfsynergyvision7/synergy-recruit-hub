/**
 * Build 54: deterministic, guarded release-candidate composition.
 *
 * IMPORTANT: The generated review bundle is deliberately NON-EXECUTABLE.
 * The first SQL statement raises a release hold before any BEGIN/DDL.
 * A separate rollback-only rehearsal is composed against the synthetic
 * source-shaped fixture, not against staging or production.
 *
 * Never remove the guard in this branch. Only a separately approved,
 * independently reviewed release process can produce a deployable migration.
 */
import {createHash} from "node:crypto";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const inputs=[
 "security/build49/67-policy-plus-account-rpcs-review-only.sql",
 "security/build51/candidate-stage-rpc-review-only.sql",
 "security/build52/candidate-write-rpc-review-only.sql",
 "security/build53/atomic-import-rpc-review-only.sql"
];
const testFixture="security/build49/67-policy-admin-profile-compat.integration.sql";
const combinedCases="security/build53/consolidated-cases.sql";
const hash=(s)=>createHash("sha256").update(s).digest("hex");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const sourceText=inputs.map(read);
const [baseline,stage,candidate,atomic]=sourceText;
const fail=(reason)=>{throw new Error("BUILD54 RELEASE CANDIDATE REFUSED: "+reason)};
if((baseline.match(/^BEGIN;$/gm)||[]).length!==1 ||
   (baseline.match(/^COMMIT;$/gm)||[]).length!==1 ||
   !baseline.includes("a70190f31ed8436b2989082898a02b51") ||
   !baseline.includes("Expected exactly 35 new approved-for-review policies") ||
   !baseline.includes("48-object baseline drift") ||
   !baseline.includes("crm_admin_manage_user") ||
   !baseline.includes("crm_update_own_profile"))
 fail("Build49 baseline/approval-RPC source changed or lacks exact fingerprints");
for(const [i,sig] of [
 [1,"crm_change_candidate_stage"],[2,"crm_write_candidate"],[3,"crm_import_candidates_atomic"]]) {
 if(!sourceText[i].includes("CREATE OR REPLACE FUNCTION public."+sig+"(") ||
    sourceText[i].includes("\nCOMMIT;"))
  fail("Unsafe candidate SQL fragment or unexpected COMMIT in "+inputs[i]);
}
const body=baseline.replace(/^BEGIN;\n/m,"").replace(/^COMMIT;\n/m,"");
if(body.includes("\nCOMMIT;"))fail("Unexpected extra COMMIT in migration");
const enforce=`
-- Build54 postflight: these are asserted *in the same transaction*.
DO $build54_postflight$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public';
 IF n<>35 THEN
  RAISE EXCEPTION 'Expected 35 restricted RLS policies; found %',n;
 END IF;
 IF has_table_privilege('anon','public.candidates','SELECT')
 OR has_table_privilege('anon','public.candidates','TRUNCATE')
 OR has_table_privilege('authenticated','public.candidates','INSERT')
 OR has_table_privilege('authenticated','public.candidates','UPDATE')
 OR has_table_privilege('authenticated','public.candidates','DELETE')
 OR has_column_privilege('authenticated','public.candidates','stage','UPDATE')
 THEN RAISE EXCEPTION 'Unsafe candidate grants remain in Build54'; END IF;
 IF NOT has_function_privilege('authenticated',
 'public.crm_change_candidate_stage(uuid,text,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
 'public.crm_write_candidate(uuid,timestamptz,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
 'public.crm_import_candidates_atomic(uuid,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Expected candidate RPC grants not installed'; END IF;
 IF has_function_privilege('anon',
 'public.crm_write_candidate(uuid,timestamptz,jsonb)','EXECUTE')
 OR has_function_privilege('anon',
 'public.crm_change_candidate_stage(uuid,text,text)','EXECUTE')
 OR has_function_privilege('anon',
 'public.crm_import_candidates_atomic(uuid,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous privileged candidate RPC access'; END IF;
 IF has_schema_privilege('authenticated','crm_private','USAGE')
 OR has_schema_privilege('anon','crm_private','USAGE')
 THEN RAISE EXCEPTION 'Private import ledger schema exposed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.candidates'::regclass
    AND tgname='zz_crm_candidate_monotonic_version' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'Strict candidate monotonic-version trigger absent'; END IF;
END $build54_postflight$;
`;
const appended=[body,stage,candidate,atomic,enforce].join("\n\n");
const reviewGuard=`-- Build54 REVIEW ONLY, never executable on any database.
-- This refusal intentionally comes BEFORE the first BEGIN/DDL statement.
DO $build54_release_hold$
BEGIN
 RAISE EXCEPTION 'Build54 release BLOCKED: independent approvals, real hosted Auth UAT, restore drill, finance governance and protected main required'
 USING ERRCODE='42501';
END $build54_release_hold$;
`;
// A SQL client without ON_ERROR_STOP can execute statements AFTER a failure.
// A first-statement RAISE is therefore NOT an adequate guard if destructive
// DDL follows it. Never write runnable migration DDL to any .sql review file.
const reviewSql=reviewGuard+"\n-- END OF NON-EXECUTABLE HOLD FILE.\n";
const reviewDoc=[
 "# Build54/55 — HUMAN REVIEW MIGRATION TEXT — NOT A DEPLOYABLE SQL FILE",
 "",
 "**HOLD: no authorization to execute this content or remove the review stop.**",
 "Only the separate synthetic full-release-rollback.integration.sql is runnable",
 "against a disposable PostgreSQL 17 fixture, and it always rolls back.",
 "",
 "The following source-shaped migration is a review artifact in Markdown.",
 "Do NOT extract/apply it until the formal nine-gate release, finance/retention",
 "review, actual hosted Auth acceptance, backup/restore and approval:",
 "",
 "```sql",
 "BEGIN;",
 appended,
 "ROLLBACK;",
 "```",
 ""
].join("\n");
const manifest={
 schema_version:1,
 build:"54",
 state:"NON_EXECUTABLE_REVIEW_HOLD",
 old_policy_count:67,
 old_policy_fingerprint:"a70190f31ed8436b2989082898a02b51",
 replacement_policy_count:35,
 candidate_rpc_count:3,
 source_sha256:Object.fromEntries(inputs.map((name,i)=>[name,hash(sourceText[i])])),
 review_bundle_sha256:hash(reviewSql),
 rollback_rehearsal_only:true,
 no_release_authorization:true
};
const outDir="/tmp/build54-release-review";
mkdirSync(outDir,{recursive:true});
writeFileSync(outDir+"/release-review-hold.sql",reviewSql);
writeFileSync(outDir+"/release-candidate-HUMAN-REVIEW.md",reviewDoc);
writeFileSync(outDir+"/manifest.json",JSON.stringify(manifest,null,2)+"\n");
const fixture=read(testFixture);
const negEnd="ROLLBACK TO SAVEPOINT b48_policy_drift;\n";
const suffixStart="-- Build49: Account management and self-profile compatibility AFTER the full";
if(fixture.split(negEnd).length!==2 || fixture.split(suffixStart).length!==2)
 fail("Build49 fixture anchors drifted: refuse to generate the rehearsal");
const fixturePrefix=fixture.split(negEnd)[0]+negEnd;
const fixtureSuffix=fixture.slice(fixture.indexOf(suffixStart));
const fixtureAdjustment=`
-- Synthetic fixture compatibility only; these defaults exist in production.
ALTER TABLE public.candidates ALTER COLUMN id SET DEFAULT gen_random_uuid();
UPDATE public.candidates SET updated_at=clock_timestamp() WHERE updated_at IS NULL;
UPDATE public.candidates SET stage='lead_received' WHERE stage IS NULL;
`;
const rehearsal=fixturePrefix+"\n"+fixtureAdjustment+"\n"+appended+
 "\n"+read(combinedCases)+"\n"+fixtureSuffix;
if((rehearsal.match(/^BEGIN;$/gm)||[]).length!==1 ||
   (rehearsal.match(/^ROLLBACK;$/gm)||[]).length!==1 ||
   (rehearsal.match(/^COMMIT;$/gm)||[]).length!==0)
 fail("Rehearsal is not exactly one rollback-only transaction");
writeFileSync(outDir+"/full-release-rollback.integration.sql",rehearsal);
writeFileSync(outDir+"/rehearsal-sha256.txt",hash(rehearsal)+"\n");
process.stdout.write(JSON.stringify({
 output_dir:outDir,
 sources:inputs.length,
 baseline_policy_fingerprint:manifest.old_policy_fingerprint,
 release_guarded:true,
 rehearsal_rollback_only:true,
 bundle_sha256:manifest.review_bundle_sha256,
 rehearsal_sha256:hash(rehearsal),
 bytes:rehearsal.length
})+"\n");
