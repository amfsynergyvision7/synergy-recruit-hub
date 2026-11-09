-- SEC-02 REVIEW ONLY: verify all 15 broad policies can be removed
-- without committing. Production schema only; no data reads or mutations.
-- This does NOT prove application workflows pass after removal.
begin;
do $$
declare p record;
begin
 for p in
  select tablename from pg_policies
  where schemaname='public'
    and policyname='Allow all for authenticated' and cmd='ALL'
 loop
  execute format('drop policy %I on public.%I',
                 'Allow all for authenticated',p.tablename);
 end loop;
end $$;
do $$
declare remaining integer;
begin
 select count(*) into remaining from pg_policies
 where schemaname='public' and cmd='ALL' and qual='true';
 if remaining<>0 then
  raise exception 'SEC-02: % unconditional ALL policies remain',remaining;
 end if;
end $$;
-- After broad policy removal, candidate_activities has SELECT only:
-- a scoped INSERT policy must be reviewed before enabling activity creation.
select tablename, string_agg(distinct cmd,', ' order by cmd) as remaining_commands
from pg_policies
where schemaname='public'
and tablename in ('audit_logs','billing','candidate_activities','candidates',
'clients','google_integrations','integrations','interviews','job_openings',
'notifications','offers','profiles','submissions','sync_logs','user_roles')
group by tablename order by tablename;
rollback;
