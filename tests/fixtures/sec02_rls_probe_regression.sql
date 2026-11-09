-- SEC-02 regression test: isolated security_lab project only.
-- Fixture security_lab.sec02_rls_probe has owner-scoped SELECT policy and
-- two synthetic rows owned by UUID 111... and 222... .
-- Run as SQL administrator; all test role changes are transaction-local.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare visible_own integer; visible_other integer;
begin
 select count(*) into visible_own from security_lab.sec02_rls_probe where owner_id='11111111-1111-4111-8111-111111111111';
 select count(*) into visible_other from security_lab.sec02_rls_probe where owner_id='22222222-2222-4222-8222-222222222222';
 if visible_own <> 1 or visible_other <> 0 then
   raise exception 'SEC-02 RLS regression: own %, other %', visible_own, visible_other;
 end if;
end $$;
rollback;
-- The former permissive FOR ALL USING(true) policy exposed the other
-- owner's synthetic record (1 row). Without it, the query returns 0.
