import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const migration=read('security/build46/drive-file-ledger-review-only.sql');
const sql=read('security/build46/drive-ledger-rollback.integration.sql');
const trigger=read('security/build46/drive-production-trigger.integration.sql');
const importer=read('src/lib/drive-import.server.ts');
const endpoint=read('src/lib/ai.functions.ts');
const sheet=read('security/build43/candidate-row-commit-review-only.sql');

test('Drive file ledger is durable with a global file ID unique key and RLS',()=>{
 assert.match(migration,/file_id text PRIMARY KEY/);
 assert.match(migration,/folder_id text NOT NULL/);
 assert.match(migration,/owner_id uuid NOT NULL/);
 assert.match(migration,/candidate_id uuid NOT NULL REFERENCES public\.candidates\(id\)/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL ON crm_private\.drive_resume_import_ledger FROM PUBLIC,anon,authenticated/);
});
test('Drive atomic commit requires actual approved admin and active recruiter',()=>{
 assert.match(migration,/p\.id=p_owner AND p\.status='approved' AND p\.is_active IS TRUE AND r\.role='admin'/);
 assert.match(migration,/p\.id=p_assigned_recruiter AND p\.status='approved' AND p\.is_active IS TRUE AND r\.role='recruiter'/);
});
test('Drive folder identity is grounded in the singleton administrator settings',()=>{
 assert.match(migration,/FROM public\.app_settings s WHERE s\.id=1 FOR SHARE/);
 assert.match(migration,/v_folder:=substring\(coalesce\(v_url,''\) from '\/folders\//);
 assert.match(migration,/Drive import folder not approved/);
});
test('Drive source extraction allows only identity/experience fields',()=>{
 assert.match(migration,/ARRAY\['full_name','email','mobile','position_applied','experience_years'\]/);
 assert.match(migration,/Insufficient or invalid candidate identity/);
 assert.doesNotMatch(migration,/p_extracted->>'stage'/);
 assert.doesNotMatch(migration,/p_extracted->>'assigned_recruiter'/);
});
test('Drive and Sheets importers share one transaction advisory-lock domain',()=>{
 const lock="hashtextextended('crm_candidate_sync_importers',0)";
 assert.ok(migration.includes(lock));
 assert.ok(sheet.includes(lock));
});
test('Drive RPC rejects a previously imported legacy URL without a ledger record',()=>{
 assert.match(migration,/Legacy Drive file requires ledger reconciliation/);
 assert.match(migration,/substring\(coalesce\(c\.resume_url,''\) from '\/file\/d\//);
 assert.match(migration,/substring\(coalesce\(c\.resume_url,''\) from '\[\?&\]id=/);
});
test('Drive candidate updates preserve existing nonblank fields and original recruiter',()=>{
 assert.match(migration,/email=coalesce\(nullif\(btrim\(c\.email\),''\),v_email\)/);
 assert.match(migration,/position_applied=coalesce\(nullif\(btrim\(c\.position_applied\),''\),v_position\)/);
 assert.match(migration,/resume_url=coalesce\(nullif\(btrim\(c\.resume_url\),''\),v_resume_url\)/);
 assert.doesNotMatch(migration,/UPDATE public\.candidates c SET[\s\S]*assigned_recruiter=/);
});
test('Drive ledger and list RPC execution is restricted to service_role',()=>{
 for(const f of ["crm_commit_drive_resume_import(uuid,uuid,text,text,jsonb)","crm_list_drive_imported_file_ids(uuid,text)"]){
  assert.ok(migration.includes("REVOKE EXECUTE ON FUNCTION public."+f));
  assert.ok(migration.includes("GRANT EXECUTE ON FUNCTION public."+f+" TO service_role"));
 }
});
test('Drive server entry remains unconditionally paused before all credentials/network',()=>{
 const hold=importer.indexOf('assertDriveBulkImportReviewed();');
 const key=importer.indexOf('process.env.DRIVE_API_KEY');
 const network=importer.indexOf('await listFolderFiles(');
 assert.ok(hold>0&&key>hold&&network>key);
 assert.match(importer,/throw new Error\("Drive bulk import paused pending transactional idempotency approval"\)/);
});
test('legacy direct candidate writes have been removed from the review-branch importer',()=>{
 assert.doesNotMatch(importer,/\.from\(["']candidates["']\)/);
 assert.doesNotMatch(importer,/\.insert\(insertPayload\)/);
 assert.doesNotMatch(importer,/\.update\(updates\)/);
});
test('authorized endpoint propagates user id and uses only service-role commit/list RPCs',()=>{
 assert.match(endpoint,/await assertApprovedRole\(context\.userId, \["admin"\]\);[\s\S]*runResumeDriveImport\(context\.supabase, context\.userId\)/);
 assert.match(importer,/crm_list_drive_imported_file_ids/);
 assert.match(importer,/crm_commit_drive_resume_import/);
 for(const f of ['p_owner: ownerId','p_assigned_recruiter: recruiterId','p_folder_id: folderId','p_file_id: file.id','p_extracted:'])
  assert.ok(importer.includes(f),f);
});
test('RPC response rejects invalid shapes instead of falling back to raw updates',()=>{
 assert.match(importer,/commitError \|\| !Array\.isArray\(committed\) \|\| committed\.length !== 1/);
 assert.match(importer,/Unknown Drive import commit result/);
 assert.match(importer,/Atomic Drive import commit unavailable/);
});
test('partial failure, duplicate replay, conflicting match and legacy refusal are rehearsed',()=>{
 for(const phrase of ['partial transaction survived failure','Drive ID replay not stable','ambiguous match allowed','legacy file silently reprocessed','ledger listing count','no_persistent_ledger'])assert.ok(sql.includes(phrase),phrase);
});
test('production-derived SQL fixture reproduces real candidate/integration triggers',()=>{
 const names=['on_candidate_stage_change','run_workflow_rules','set_assigned_recruiter','set_candidate_sync_defaults','set_updated_at','sync_google_integration_mapping','track_stage_changes'];
 for(const name of names) assert.ok(trigger.includes('FUNCTION public.'+name+'()'),name);
 assert.match(trigger,/real production trigger defaults or assigned recruiter failed/);
 assert.match(trigger,/ROLLBACK;/);
});
test('migration is a review-only proposal and does not activate Drive import',()=>{
 assert.match(migration,/REVIEW ONLY/);
 assert.match(importer,/assertDriveBulkImportReviewed\(\);/);
 assert.ok(!migration.includes('SUPABASE_SERVICE_ROLE_KEY'));
});
