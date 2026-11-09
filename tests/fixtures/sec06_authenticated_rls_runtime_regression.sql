-- SEC-06: isolated synthetic authenticated RLS runtime regression.
-- Executed successfully against isolated Supabase with BEGIN/ROLLBACK.
-- No candidate records or production data. Requires security_lab schema.
begin;
create table security_lab.sec06_rls_runtime_probe
(id integer primary key, owner_id uuid not null, note text);
insert into security_lab.sec06_rls_runtime_probe values
(1,'11111111-1111-4111-8111-111111111111','owner'),
(2,'22222222-2222-4222-8222-222222222222','other');
alter table security_lab.sec06_rls_runtime_probe enable row level security;
grant usage on schema security_lab to authenticated;
grant select,update on security_lab.sec06_rls_runtime_probe to authenticated;
create policy sec06_owner_read on security_lab.sec06_rls_runtime_probe
for select to authenticated using (owner_id=auth.uid());
create policy sec06_owner_update on security_lab.sec06_rls_runtime_probe
for update to authenticated using (owner_id=auth.uid())
with check(owner_id=auth.uid());
set local role authenticated;
select set_config('request.jwt.claim.sub',
'11111111-1111-4111-8111-111111111111',true);
do $$ declare n integer;
begin
 select count(*) into n from security_lab.sec06_rls_runtime_probe;
 if n<>1 then raise exception 'read isolation failed %',n; end if;
 update security_lab.sec06_rls_runtime_probe set note='blocked' where id=2;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'cross owner update succeeded'; end if;
 update security_lab.sec06_rls_runtime_probe set note='permitted' where id=1;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'own update failed'; end if;
 begin
  update security_lab.sec06_rls_runtime_probe
  set owner_id='22222222-2222-4222-8222-222222222222' where id=1;
  raise exception 'ownership reassignment succeeded';
 exception when insufficient_privilege then null; end;
end $$;
select count(*) as visible_rows from security_lab.sec06_rls_runtime_probe;
rollback;
