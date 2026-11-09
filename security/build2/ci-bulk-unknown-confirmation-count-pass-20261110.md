# Bulk unexpected-exception confirmation count — consolidated verification (2026-11-10)

## Draft-only correction
In `src/components/CrudModule.tsx`, unexpected exceptions from the bulk batch caller previously replaced the result with an empty confirmation set, then reported `0 of N explicitly confirmed`. This was misleading if earlier batches had committed. Both bulk deletion and bulk editing now track `confirmationCountKnown` and display **confirmation count unavailable** for unexpected exceptions. The unknown-outcome warning, cleared selection, and authoritative refresh-before-reselection remain intact.

Added `security/build2/crud-bulk-confirmation-count-unknown.test.mjs` and updated `crud-bulk-unexpected-exception-recovery.test.mjs` to reflect the new reporting guard.

## CI
Initial run #388 reported two failing outdated static test expectations. These were corrected; run #390 passed all three jobs:
https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42703512308

Application build/TypeScript: pass. Offline security tests: pass. Isolated PostgreSQL: pass.

## Limitations
This does **not** provide per-ID reconciliation or establish how many earlier batches committed after an unexpected exception. It avoids an inaccurate count and blind retry only. Browser/real-role testing remains pending. No database writes, merge, deployment, external communications or finance-rule changes. All nine release gates remain false.
