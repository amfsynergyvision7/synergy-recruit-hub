-- SEC-10 isolated regression; synthetic schema matches production settings fields.
begin;
create table security_lab.batch10_app_settings(
id integer primary key default 1,logo_url text,resume_import_folder_url text,
default_color_theme text not null default 'neon',updated_by uuid,
updated_at timestamptz not null default now());
insert into security_lab.batch10_app_settings(id,logo_url,resume_import_folder_url)
values(1,'synthetic-logo','synthetic-private-folder');
alter table security_lab.batch10_app_settings enable row level security;
create policy batch10_auth_read on security_lab.batch10_app_settings
for select to authenticated using ((select auth.uid()) is not null);
grant usage on schema security_lab to anon,authenticated;
grant select on security_lab.batch10_app_settings to anon,authenticated;
set local role anon;
do $$declare n int;begin
select count(*) into n from security_lab.batch10_app_settings;
if n<>0 then raise exception 'anonymous app settings exposure';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$declare n int;begin
select count(*) into n from security_lab.batch10_app_settings;
if n<>1 then raise exception 'authenticated read failed';end if;
end$$;
reset role;
select 'PASS: anon denied; authenticated allowed' as result;
rollback;
