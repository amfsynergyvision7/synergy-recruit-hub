-- Run only after synthetic_candidates is created in the isolated test database.
-- Not part of production migrations.
-- SEC-11/SEC-12 isolated synthetic test fixtures only.
-- This migration is NOT a production policy or a live email/AI implementation.
create schema if not exists security_lab;
revoke all on schema security_lab from public, anon, authenticated;
create table if not exists security_lab.email_send_intents (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references security_lab.synthetic_candidates(id),
 recipient text not null check (recipient like '%@example.invalid'),
 purpose text not null check (purpose = 'synthetic_test'),
 idempotency_key text not null unique check (length(idempotency_key) between 8 and 128),
 state text not null default 'held' check (state in ('held','cancelled')),
 created_at timestamptz not null default now()
);
create table if not exists security_lab.ai_operation_intents (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references security_lab.synthetic_candidates(id),
 operation text not null check (operation in ('synthetic_match','synthetic_summary')),
 state text not null default 'held' check (state in ('held','cancelled')),
 created_at timestamptz not null default now()
);
alter table security_lab.email_send_intents enable row level security;
alter table security_lab.email_send_intents force row level security;
alter table security_lab.ai_operation_intents enable row level security;
alter table security_lab.ai_operation_intents force row level security;
revoke all on security_lab.email_send_intents, security_lab.ai_operation_intents from public, anon, authenticated;
-- No policies or dispatch workers: all application access remains denied.
