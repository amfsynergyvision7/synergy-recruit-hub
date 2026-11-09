-- Run after an approved SEC-02 migration. Returns 0 for a pass.
-- This is a read-only release gate, not a data migration.
select count(*) as anon_tables_still_readable
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
and c.relname=any(array['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles'])
and has_table_privilege('anon',c.oid,'SELECT');
-- Both conditions must be zero after remediation:
select count(*) as broad_public_all_policies_remaining
from pg_policies
where schemaname='public' and cmd='ALL' and qual='true';
