import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('./full-synthetic-postseed.readonly.sql',import.meta.url),'utf8');

test('full 19-table postseed checker is SELECT-only and requires 38 invented rows',()=>{
 assert.equal((sql.match(/ AS table_name, [0-9]+::bigint AS expected_count/g)||[]).length,19);
 assert.match(sql,/table_groups=19 AND mismatched_table_groups=0 AND total_application_rows=38/);
 assert.match(sql,/auth_users=9 AND exact_synthetic_email_users=9/);
 assert.match(sql,/unprofiled_and_unroled_auth_slots=1/);
 assert.match(sql,/role_status_group_mismatches=0/);
 assert.match(sql,/approved_recruiter_owned_candidates=2/);
 assert.match(sql,/signed_uat_cases_accepted/);
 assert.match(sql,/HOLD_BUILD79_FULL_SYNTHETIC_POSTSEED_INTEGRITY/);
 assert.doesNotMatch(sql,/^\s*(?:INSERT INTO|UPDATE\s|DELETE FROM|GRANT\s|CREATE\s|ALTER\s|TRUNCATE\s|SELECT\s+email\s|SELECT\s+password\s)/gmi);
});

test('postseed checker refuses external financial, email, sync and realtime activation',()=>{
 assert.match(sql,/inactive_rule_rows=1/);
 assert.match(sql,/inert_google_rows=1/);
 assert.match(sql,/inert_sheet_rows=1/);
 assert.match(sql,/inert_mail_rows=1/);
 assert.match(sql,/inert_sync_rows=1/);
 assert.match(sql,/inert_finance_rows=1/);
 assert.match(sql,/inert_offer_rows=1/);
 assert.match(sql,/inert_notification_rows=2/);
 assert.match(sql,/linked_submission_rows=2 AND linked_unscheduled_interviews=2/);
 assert.match(sql,/enabled_app_triggers=0 AND published_app_tables=0/);
});
