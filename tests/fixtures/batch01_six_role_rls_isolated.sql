-- SEC-02/03/05/06 coordinated isolated batch regression.
-- Six role identities, actual authenticated DB role, auth.uid(), RLS policy.
-- Entire script rolls back; NEVER run against production.
begin;
create table security_lab.batch_profiles(id uuid primary key,status text not null,is_active boolean not null);
create table security_lab.batch_roles(user_id uuid not null,role text not null,primary key(user_id,role));
create table security_lab.batch_candidates(id uuid primary key,assigned_recruiter uuid not null,display_name text not null);
create function security_lab.batch_has_role(uid uuid,desired text)
returns boolean language sql stable security definer set search_path=security_lab,pg_temp as $$
select exists(select 1 from security_lab.batch_roles r
join security_lab.batch_profiles p on p.id=r.user_id
where r.user_id=uid and r.role=desired and p.status='approved' and p.is_active) $$;
insert into security_lab.batch_profiles values
('11111111-1111-4111-8111-111111111111','approved',true),
('22222222-2222-4222-8222-222222222222','approved',true),
('33333333-3333-4333-8333-333333333333','approved',true),
('44444444-4444-4444-8444-444444444444','approved',true),
('55555555-5555-4555-8555-555555555555','pending',true),
('66666666-6666-4666-8666-666666666666','approved',false);
insert into security_lab.batch_roles values
('11111111-1111-4111-8111-111111111111','admin'),
('22222222-2222-4222-8222-222222222222','recruiter'),
('33333333-3333-4333-8333-333333333333','operations'),
('44444444-4444-4444-8444-444444444444','finance'),
('55555555-5555-4555-8555-555555555555','admin'),
('66666666-6666-4666-8666-666666666666','recruiter');
insert into security_lab.batch_candidates values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','Synthetic A'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','Synthetic B');
alter table security_lab.batch_candidates enable row level security;
create policy batch_read on security_lab.batch_candidates for select to authenticated using (
 security_lab.batch_has_role((select auth.uid()),'admin')
 or (security_lab.batch_has_role((select auth.uid()),'recruiter') and assigned_recruiter=(select auth.uid()))
 or security_lab.batch_has_role((select auth.uid()),'operations')
);
grant usage on schema security_lab to authenticated;
grant select on security_lab.batch_candidates to authenticated;
grant execute on function security_lab.batch_has_role(uuid,text) to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$declare n int;begin select count(*) into n from security_lab.batch_candidates; if n<>1 then raise exception 'recruiter expected 1 got %',n;end if;end$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$declare n int;begin select count(*) into n from security_lab.batch_candidates; if n<>2 then raise exception 'admin expected 2 got %',n;end if;end$$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$declare n int;begin select count(*) into n from security_lab.batch_candidates; if n<>2 then raise exception 'operations expected 2 got %',n;end if;end$$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$declare n int;begin select count(*) into n from security_lab.batch_candidates; if n<>0 then raise exception 'finance expected 0 got %',n;end if;end$$;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $$declare n int;begin select count(*) into n from security_lab.batch_candidates; if n<>0 then raise exception 'pending expected 0 got %',n;end if;end$$;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $$declare n int;begin select count(*) into n from security_lab.batch_candidates; if n<>0 then raise exception 'inactive expected 0 got %',n;end if;end$$;
reset role;
select 'PASS six-role RLS runtime matrix' result;
rollback;
