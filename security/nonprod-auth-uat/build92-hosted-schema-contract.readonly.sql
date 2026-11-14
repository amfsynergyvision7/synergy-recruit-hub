-- BUILD92: NONPRODUCTION project dhlhlasnaapzckjyvffn ONLY; SELECT-only schema drift check.
-- A technical SQL preflight, NOT Auth provisioning permission or formal UAT.
-- Snapshot is pinned to hosted metadata observed 13 November 2026;
-- recheck against the exact project immediately before any synthetic CREATE.
WITH cols AS (
 SELECT table_name,column_name,ordinal_position::int AS ordinal_position,
 data_type,udt_name,is_nullable,coalesce(column_default,'<NULL>') AS column_default,
 is_identity,is_generated
 FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('profiles','user_roles','candidates','clients','job_openings','candidate_activities','audit_logs','google_integrations','integrations','candidate_stage_history','submissions','interviews','offers','billing','notifications','sync_logs','app_settings','email_log','workflow_rules')
),snapshot AS (
 SELECT count(*)::int AS columns_seen,count(DISTINCT table_name)::int AS tables_seen,
 count(*) FILTER (WHERE is_nullable='NO' AND column_default='<NULL>' AND is_identity='NO' AND is_generated='NEVER')::int AS required_no_default_columns,
 md5(string_agg(table_name||'|'||column_name||'|'||ordinal_position||'|'||data_type||'|'||udt_name||'|'||is_nullable||'|'||column_default||'|'||is_identity||'|'||is_generated,E'\n' ORDER BY table_name,ordinal_position)) AS schema_fingerprint
 FROM cols
)
SELECT tables_seen,columns_seen,required_no_default_columns,schema_fingerprint,
 CASE WHEN tables_seen=19 AND columns_seen=239 AND required_no_default_columns=101
 AND schema_fingerprint='e51f1648c517e88831a3c07740476bf3'
 THEN 'TECHNICAL_FIXTURE_SCHEMA_BASELINE_PASS_NOT_PROVISIONING_PERMISSION'
 ELSE 'HOLD_FIXTURE_SCHEMA_DRIFT' END AS schema_gate
FROM snapshot;
