/**
 * Build 50 — review branch only. These are presentation-level holds, not
 * authorization controls. Server-side RLS, RPC privileges and signed-user
 * acceptance must independently enforce the approved business rules.
 *
 * Do not replace these constants with environment flags: a build-time flag
 * could reopen legacy client DML before its authorization model is approved.
 * Remove the holds only in the same reviewed change that replaces all
 * legacy mutation paths with tested, audited server-side commands.
 */
export const LEGACY_CANDIDATE_WRITES_PAUSED = true as const;
export const LEGACY_BULK_IMPORT_WRITES_PAUSED = true as const;
// Build56: a joined offer can invoke BOTH live billing handlers.
// This is a presentation hold only; the review SQL adds an independent
// BEFORE-trigger gate that also protects non-browser and privileged callers.
export const LEGACY_JOINED_FINANCIAL_TRANSITIONS_PAUSED = true as const;
// A finance policy has not authorized manual invoices or payment edits.
export const LEGACY_BILLING_MUTATIONS_PAUSED = true as const;
export const BILLING_MUTATION_HOLD_REASON =
  "Billing creation, payment changes and deletion are view-only pending independent finance and security approval.";
export const FINANCIAL_JOINED_HOLD_REASON =
  "Joined offer transitions and edits are paused pending financial approval and independent authorization testing.";

export const CANDIDATE_MUTATION_HOLD_REASON =
  "Candidate edits, deletes, stage moves and duplicate cleanup are paused pending audited CRM write commands and hosted role acceptance.";
export const BULK_IMPORT_HOLD_REASON =
  "CSV/Excel preview remains available; row-by-row browser import writes are paused pending an atomic, reviewed server-side import.";

export function assertLegacyCandidateWritePaused(): void {
  if (LEGACY_CANDIDATE_WRITES_PAUSED) {
    throw new Error(CANDIDATE_MUTATION_HOLD_REASON);
  }
}

export function assertLegacyImportWritePaused(): void {
  if (LEGACY_BULK_IMPORT_WRITES_PAUSED) {
    throw new Error(BULK_IMPORT_HOLD_REASON);
  }
}
