-- Batch 04: isolated candidate mutation RLS. Run ONLY in security_lab; rollback.
-- Six assertions: owner update yes, cross-owner no, self-reassignment no,
-- finance no, pending admin no, approved admin reassignment yes.
begin;
create table security_lab.batch04_profiles(id uuid primary key,status text,is_active boolean);
create table security_lab.batch04_roles(user_id uuid,role text);
create table security_lab.batch04_candidates(id uuid primary key,full_name text not null,assigned_recruiter uuid,created_by uuid,status text default 'active');
create function security_lab.batch04_has_role(uid uuid,desired text) returns boolean
language sql stable security definer set search_path=security_lab,pg_temp as $$
select exists(select 1 from security_lab.batch04_roles r
join security_lab.batch04_profiles p on p.id=r.user_id
where r.user_id=uid and r.role=desired and p.status='approved' and p.is_active)$$;
insert into security_lab.batch04_profiles values
('11111111-1111-4111-8111-111111111111','approved',true),
('22222222-2222-4222-8222-222222222222','approved',true),
('33333333-3333-4333-8333-333333333333','approved',true),
('44444444-4444-4444-8444-444444444444','approved',true),
('55555555-5555-4555-8555-555555555555','pending',true);
insert into security_lab.batch04_roles values
('11111111-1111-4111-8111-111111111111','admin'),
('22222222-2222-4222-8222-222222222222','recruiter'),
('33333333-3333-4333-8333-333333333333','recruiter'),
('44444444-4444-4444-8444-444444444444','finance'),
('55555555-5555-4555-8555-555555555555','admin');
insert into security_lab.batch04_candidates values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic A','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','active'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic B','33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333','active');
alter table security_lab.batch04_candidates enable row level security;
create policy batch04_read on security_lab.batch04_candidates for select to authenticated using (
security_lab.batch04_has_role((select auth.uid()),'admin')
or (security_lab.batch04_has_role((select auth.uid()),'recruiter') and assigned_recruiter=(select auth.uid())));
create policy batch04_update on security_lab.batch04_candidates for update to authenticated using (
security_lab.batch04_has_role((select auth.uid()),'admin')
or (security_lab.batch04_has_role((select auth.uid()),'recruiter') and assigned_recruiter=(select auth.uid())))
with check (
security_lab.batch04_has_role((select auth.uid()),'admin')
or (security_lab.batch04_has_role((select auth.uid()),'recruiter') and assigned_recruiter=(select auth.uid())));
grant usage on schema security_lab to authenticated;
grant select,update on security_lab.batch04_candidates to authenticated;
grant execute on function security_lab.batch04_has_role(uuid,text) to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$declare n int;begin
update security_lab.batch04_candidates set status='contacted' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
get diagnostics n=row_count;if n<>1 then raise exception 'owner update failed';end if;end$$;
do $$declare n int;begin
update security_lab.batch04_candidates set status='contacted' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
get diagnostics n=row_count;if n<>0 then raise exception 'cross-owner update allowed';end if;end$$;
do $$declare denied boolean:=false;begin
begin update security_lab.batch04_candidates
set assigned_recruiter='33333333-3333-4333-8333-333333333333'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'owner reassignment allowed';end if;end$$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$declare n int;begin
update security_lab.batch04_candidates set status='tampered';
get diagnostics n=row_count;if n<>0 then raise exception 'finance mutation allowed';end if;end$$;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $$declare n int;begin
update security_lab.batch04_candidates set status='tampered';
get diagnostics n=row_count;if n<>0 then raise exception 'pending admin mutation allowed';end if;end$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$declare n int;begin
update security_lab.batch04_candidates
set assigned_recruiter='33333333-3333-4333-8333-333333333333'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
get diagnostics n=row_count;if n<>1 then raise exception 'admin reassignment failed';end if;end$$;
reset role;
select 'PASS six mutation assertions' result;
rollback;
