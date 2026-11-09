import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./privileged-rpc-grants-review-only.sql',import.meta.url),'utf8');
test('grant SQL explicitly prohibits production execution',()=>assert.match(sql,/DO NOT RUN ON PRODUCTION/));
test('grant SQL is transaction-scoped',()=>{assert.match(sql,/\bBEGIN;/);assert.match(sql,/\bCOMMIT;/)});
for(const signature of ['generate_reminders\(\)','get_user_role\(uuid\)','has_role\(uuid, public\.app_role\)','is_approved\(uuid\)','resolve_candidate_uuid\(text\)','resolve_client_uuid\(text\)','resolve_job_uuid\(text\)']) {
 test(signature+' revokes inherited PUBLIC and anon access',()=>{
  assert.match(sql,new RegExp('REVOKE EXECUTE ON FUNCTION public\\.'+signature+' FROM PUBLIC, anon','i'));
 });
}
test('reminders also revokes direct authenticated invocation',()=>assert.match(sql,/generate_reminders\(\) FROM PUBLIC, anon, authenticated/));
test('authenticated enumeration remains a documented blocker',()=>assert.match(sql,/authenticated enumeration mitigation/));
