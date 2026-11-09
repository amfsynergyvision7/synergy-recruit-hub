-- READ-ONLY production policy inventory and release-gate query.
-- Fails the security gate whenever unconditional permissive FOR ALL policies
-- exist in public; inspect affected tables before modifying production.
select tablename,policyname,cmd,roles,qual,with_check
from pg_policies
where schemaname='public' and cmd='ALL' and qual='true'
order by tablename,policyname;
-- Inventory scoped policies by operation before removing broad policies.
select t.tablename,
 count(*) filter(where p.policyname <> 'Allow all for authenticated') as scoped_policy_count,
 string_agg(distinct p.cmd,', ') filter(where p.policyname <> 'Allow all for authenticated') as scoped_commands
from pg_policies t
left join pg_policies p on p.schemaname=t.schemaname and p.tablename=t.tablename
where t.schemaname='public' and t.policyname='Allow all for authenticated'
group by t.tablename order by t.tablename;
