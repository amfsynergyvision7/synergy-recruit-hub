-- Isolated synthetic authorization matrix, no real user data.
-- Tests role membership versus approved/active eligibility.
begin;
create schema if not exists security_lab;
create table if not exists security_lab.sec03_profiles
(id uuid primary key,status text not null,is_active boolean not null);
create table if not exists security_lab.sec03_roles
(user_id uuid not null,role text not null,primary key(user_id,role));
insert into security_lab.sec03_profiles values
('11111111-1111-4111-8111-111111111111','approved',true),
('22222222-2222-4222-8222-222222222222','pending',true),
('33333333-3333-4333-8333-333333333333','approved',false)
on conflict(id) do update set status=excluded.status,is_active=excluded.is_active;
insert into security_lab.sec03_roles values
('11111111-1111-4111-8111-111111111111','admin'),
('22222222-2222-4222-8222-222222222222','admin'),
('33333333-3333-4333-8333-333333333333','admin')
on conflict do nothing;
do $$ declare actual boolean; expected boolean; p record;
begin
 for p in select id,status,is_active from security_lab.sec03_profiles loop
  select p.status='approved' and p.is_active and exists
    (select 1 from security_lab.sec03_roles r where r.user_id=p.id and r.role='admin')
    into actual;
  expected := p.id='11111111-1111-4111-8111-111111111111';
  if actual is distinct from expected then raise exception 'SEC-03 role matrix failed for %',p.id; end if;
 end loop;
end $$;
select p.status,p.is_active,
(p.status='approved' and p.is_active and exists
 (select 1 from security_lab.sec03_roles r where r.user_id=p.id and r.role='admin')) as permitted
from security_lab.sec03_profiles p order by p.id;
rollback;
