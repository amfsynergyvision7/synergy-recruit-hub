-- SEC-07 review only: direct activity history mutation lock-down.
-- Compiled in production schema inside BEGIN/ROLLBACK; no persistent change.
-- Before deployment review triggers, RPCs, service-role operations, and
-- whether any approved workflow needs controlled corrections or redactions.
-- Broad permissive RLS must be removed as a separate coordinated migration.
begin;
revoke update,delete on public.candidate_activities from anon,authenticated;
rollback;
