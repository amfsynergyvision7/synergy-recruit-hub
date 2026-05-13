create table if not exists public.google_integrations (
  id uuid primary key default gen_random_uuid(),
  sheet_url text,
  spreadsheet_id text,
  sheet_name text not null default 'Form Responses 1',
  header_row integer not null default 1,
  auto_sync_enabled boolean not null default false,
  sync_frequency_minutes integer not null default 2,
  last_sync timestamp with time zone,
  last_synced_row integer not null default 1,
  google_account_email text,
  connection_status text not null default 'not_configured',
  column_mapping jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint google_integrations_singleton unique (id),
  constraint google_integrations_header_row_positive check (header_row >= 1),
  constraint google_integrations_sync_frequency_positive check (sync_frequency_minutes >= 1),
  constraint google_integrations_last_synced_row_positive check (last_synced_row >= 1)
);

alter table public.google_integrations enable row level security;

create policy "admin read google integrations"
on public.google_integrations
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role));

create policy "admin write google integrations"
on public.google_integrations
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role))
with check (public.has_role(auth.uid(), 'admin'::app_role));

create trigger set_google_integrations_updated_at
before update on public.google_integrations
for each row
execute function public.set_updated_at();

create index if not exists idx_google_integrations_spreadsheet_id
on public.google_integrations (spreadsheet_id);

create index if not exists idx_google_integrations_auto_sync
on public.google_integrations (auto_sync_enabled)
where auto_sync_enabled = true;