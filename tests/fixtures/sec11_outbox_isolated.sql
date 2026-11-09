-- Isolated security_lab test project only. NEVER deploy this as a production migration.
-- No worker, no SMTP dispatch, no real recipients.
create schema if not exists security_lab;
create table if not exists security_lab.sec11_outbox (
 id uuid primary key default gen_random_uuid(),
 related_table text not null check (related_table in ('synthetic_candidates','synthetic_clients')),
 related_id uuid not null,
 recipient text not null check (recipient ~* '^[^@ ]+@example\\.invalid$'),
 subject text not null check (length(subject) between 1 and 200),
 body text not null check (length(body) between 1 and 10000),
 requested_by uuid not null,
 idempotency_key text not null unique check (length(idempotency_key) between 8 and 128),
 consent_verified boolean not null default false,
 suppression_verified boolean not null default false,
 state text not null default 'held' check (state in ('held','cancelled')),
 attempts integer not null default 0 check (attempts = 0),
 created_at timestamptz not null default now(),
 constraint sec11_no_dispatch_without_checks check (state <> 'held' or (consent_verified and suppression_verified))
);
alter table security_lab.sec11_outbox enable row level security;
alter table security_lab.sec11_outbox force row level security;
revoke all on security_lab.sec11_outbox from public, anon, authenticated;
create index if not exists sec11_outbox_created_idx on security_lab.sec11_outbox(created_at);
