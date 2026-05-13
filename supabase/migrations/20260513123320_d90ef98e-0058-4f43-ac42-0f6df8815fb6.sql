alter table public.google_integrations
add column if not exists mapping jsonb not null default '{}'::jsonb;

update public.google_integrations
set mapping = coalesce(nullif(mapping, '{}'::jsonb), column_mapping, '{}'::jsonb),
    column_mapping = coalesce(nullif(column_mapping, '{}'::jsonb), mapping, '{}'::jsonb)
where mapping is distinct from coalesce(nullif(mapping, '{}'::jsonb), column_mapping, '{}'::jsonb)
   or column_mapping is distinct from coalesce(nullif(column_mapping, '{}'::jsonb), mapping, '{}'::jsonb);

alter table public.google_integrations
alter column user_id set not null;

alter table public.google_integrations
drop constraint if exists google_integrations_user_id_key;

alter table public.google_integrations
add constraint google_integrations_user_id_key unique (user_id);

create index if not exists idx_google_integrations_user_id
on public.google_integrations (user_id);

alter table public.google_integrations enable row level security;

drop policy if exists "admin read google integrations" on public.google_integrations;
drop policy if exists "admin write google integrations" on public.google_integrations;
drop policy if exists "admin select own google integration" on public.google_integrations;
drop policy if exists "admin insert own google integration" on public.google_integrations;
drop policy if exists "admin update own google integration" on public.google_integrations;

create policy "admin select own google integration"
on public.google_integrations
for select
to authenticated
using (
  user_id = auth.uid()
  and public.has_role(auth.uid(), 'admin'::app_role)
);

create policy "admin insert own google integration"
on public.google_integrations
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.has_role(auth.uid(), 'admin'::app_role)
);

create policy "admin update own google integration"
on public.google_integrations
for update
to authenticated
using (
  user_id = auth.uid()
  and public.has_role(auth.uid(), 'admin'::app_role)
)
with check (
  user_id = auth.uid()
  and public.has_role(auth.uid(), 'admin'::app_role)
);

create or replace function public.sync_google_integration_mapping()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.column_mapping is null then
    new.column_mapping := '{}'::jsonb;
  end if;

  if new.mapping is null then
    new.mapping := '{}'::jsonb;
  end if;

  if new.mapping = '{}'::jsonb and new.column_mapping <> '{}'::jsonb then
    new.mapping := new.column_mapping;
  elsif new.column_mapping = '{}'::jsonb and new.mapping <> '{}'::jsonb then
    new.column_mapping := new.mapping;
  elsif new.mapping is distinct from old.mapping and new.column_mapping is not distinct from old.column_mapping then
    new.column_mapping := new.mapping;
  elsif new.column_mapping is distinct from old.column_mapping and new.mapping is not distinct from old.mapping then
    new.mapping := new.column_mapping;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sync_google_integration_mapping_trigger on public.google_integrations;
create trigger sync_google_integration_mapping_trigger
before insert or update on public.google_integrations
for each row
execute function public.sync_google_integration_mapping();