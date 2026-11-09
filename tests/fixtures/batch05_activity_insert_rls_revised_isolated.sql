-- Batch 05 revised: RLS INSERT ownership without SECURITY DEFINER.
-- Isolated synthetic Supabase only; no production changes. All rolled back.
begin;
create table security_lab.b06_candidates(id uuid primary key,owner_id uuid not null);
create table security_lab.b06_activities(id uuid primary key,candidate_id uuid references security_lab.b06_candidates(id),recruiter_id uuid not null);
insert into security_lab.b06_candidates values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333');
alter table security_lab.b06_candidates enable row level security;
alter table security_lab.b06_activities enable row level security;
create policy b06_candidate_select on security_lab.b06_candidates
for select to authenticated using(owner_id=(select auth.uid()));
create policy b06_activity_insert on security_lab.b06_activities
for insert to authenticated with check (
recruiter_id=(select auth.uid()) and exists(
select 1 from security_lab.b06_candidates c
where c.id=candidate_id and c.owner_id=(select auth.uid())));
grant usage on schema security_lab to authenticated;
grant select on security_lab.b06_candidates to authenticated;
grant insert on security_lab.b06_activities to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$declare n int;begin
select count(*) into n from security_lab.b06_candidates;
if n<>1 then raise exception 'candidate RLS visible %',n;end if;end$$;
insert into security_lab.b06_activities values
('00000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222');
do $$declare denied bool:=false;begin
begin insert into security_lab.b06_activities values
('00000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'cross-owner insert allowed';end if;end$$;
do $$declare denied bool:=false;begin
begin insert into security_lab.b06_activities values
('00000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333');
exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'spoofed recruiter allowed';end if;end$$;
reset role;
select 'PASS owner candidate RLS + activity INSERT isolation' result;
rollback;
