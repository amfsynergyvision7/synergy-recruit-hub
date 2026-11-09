-- Isolated synthetic SEC-04 regression, not a production migration.
-- Requires security_lab.sec04_profiles and its sec04_guard trigger.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
update security_lab.sec04_profiles set full_name='Synthetic edited' where id=auth.uid();
do $$
begin
 begin
  update security_lab.sec04_profiles set status='approved',is_active=true where id=auth.uid();
  raise exception 'SEC-04 FAIL: escalation allowed';
 exception when raise_exception then
  if sqlerrm='SEC-04 FAIL: escalation allowed' then raise; end if;
 end;
end $$;
do $$
declare r record;
begin
 select status,is_active,full_name into r from security_lab.sec04_profiles where id=auth.uid();
 if r.status <> 'pending' or r.is_active or r.full_name <> 'Synthetic edited'
 then raise exception 'SEC-04 FAIL: incorrect profile state'; end if;
end $$;
rollback;
