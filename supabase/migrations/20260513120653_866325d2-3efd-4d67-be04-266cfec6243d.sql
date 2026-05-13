alter table public.google_integrations
add column if not exists user_id uuid;

update public.google_integrations gi
set user_id = p.id
from public.profiles p
where gi.user_id is null
  and lower(p.email) = 'argha200739@gmail.com';

update public.google_integrations gi
set user_id = p.id
from (
  select id
  from public.profiles
  where public.has_role(id, 'admin'::app_role)
  order by created_at asc
  limit 1
) p
where gi.user_id is null;

alter table public.google_integrations
alter column user_id set not null;

drop index if exists public.google_integrations_only_one_settings_row;

alter table public.google_integrations
drop constraint if exists google_integrations_user_id_key;

alter table public.google_integrations
add constraint google_integrations_user_id_key unique (user_id);

create index if not exists idx_google_integrations_user_id
on public.google_integrations (user_id);

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