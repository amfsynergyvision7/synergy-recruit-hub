-- SEC-03/05 isolated synthetic approval-aware role regression.
-- Verified 5 assertions against isolated Supabase; BEGIN/ROLLBACK only.
begin;
create table security_lab.sec03_role_profile_probe(user_id uuid primary key,status text not null,is_active boolean not null);
create table security_lab.sec03_role_assignment_probe(user_id uuid not null,role text not null);
insert into security_lab.sec03_role_profile_probe values
('11111111-1111-4111-8111-111111111111','approved',true),
('22222222-2222-4222-8222-222222222222','pending',true),
('33333333-3333-4333-8333-333333333333','approved',false);
insert into security_lab.sec03_role_assignment_probe values
('11111111-1111-4111-8111-111111111111','admin'),
('22222222-2222-4222-8222-222222222222','admin'),
('33333333-3333-4333-8333-333333333333','admin');
create function security_lab.sec03_has_role_probe(uid uuid,desired_role text)
returns boolean language sql stable security definer
set search_path=security_lab,pg_temp as $$
select exists(select 1 from security_lab.sec03_role_assignment_probe ur
join security_lab.sec03_role_profile_probe p on p.user_id=ur.user_id
where ur.user_id=uid and ur.role=desired_role
and p.status='approved' and p.is_active=true) $$;
do $$ begin
if not security_lab.sec03_has_role_probe('11111111-1111-4111-8111-111111111111','admin') then raise exception 'approved admin rejected';end if;
if security_lab.sec03_has_role_probe('22222222-2222-4222-8222-222222222222','admin') then raise exception 'pending admin permitted';end if;
if security_lab.sec03_has_role_probe('33333333-3333-4333-8333-333333333333','admin') then raise exception 'inactive admin permitted';end if;
if security_lab.sec03_has_role_probe('11111111-1111-4111-8111-111111111111','finance') then raise exception 'unassigned role permitted';end if;
if security_lab.sec03_has_role_probe('44444444-4444-4444-8444-444444444444','admin') then raise exception 'missing profile permitted';end if;
end $$;
select 'PASS: five approval-aware role assertions' as result;
rollback;
