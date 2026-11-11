-- BUILD 43 REVIEW-ONLY emergency disablement for scheduled candidate sync row RPC.
-- First disable SHEETS_SYNC_CRON_ENABLED and scheduler outside SQL; do not assume
-- this revocation alone cancels an already-started transaction.
-- Preserve the ledger and candidate records for reconciliation and recovery.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.crm_commit_candidate_sync_row(uuid,uuid,uuid,integer,jsonb)
 FROM service_role;
COMMIT;
-- Never drop crm_private.candidate_sync_row_ledger as a routine rollback:
-- deleting idempotency evidence can cause duplicates on the next enablement.
-- Restore only after release approval, reconciled cursors and signed-user UAT.
