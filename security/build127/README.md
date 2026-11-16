# Build 127 — Guarded CI regression recovery, bounded local import and board accuracy

**Scope:** draft only, PR #12. No `main` merge, protected environment changes, production/staging writes, Auth user creation, financial activation, provider calls, SMTP sends or externally published claims.

## Verified starting defect

Build 126 exact-head fast CI passed 477/477 tests, but guarded CI had **28 successful jobs, one unexpected failure and one intentionally failing release-hold job**. The unexpected `build60-pr-reconciliation-and-recovery` failure was a stale source-regex assertion demanding single-quoted `profiles.eq('status','approved').eq('is_active',true)`; Build126 correctly moved to recruiter-role-ID-first, count-limited, active/approved profile selection with double-quoted queries. Build127 updates that old assertion to test the actual safer authorization predicate and count guards rather than weakening application code.

## Engineering changes

1. New `src/lib/import-file-guard.ts` (pure and testable): file metadata max **2 MiB**, extension `.csv/.xls/.xlsx`, rows **1–500**, headers **1–80** with case-insensitive duplicate detection, short nonempty header names, and cells at most **16,384 characters**; nested cell objects and malformed data are rejected.
2. Bulk importer checks size/extension **before** file parsing and local grid limits before rendering. CSV parsing stops at **501** rows to detect overflow; XLSX decoder receives a **502-sheet-row** upper bound and refuses out-of-range dimensions. Stale async selections cannot overwrite current file, and changing the file clears old private preview content first. Raw parser errors are not shown to users.
3. Candidate board now validates every received stage against known configured stages; unknown stage/invalid candidate ID refuses a seemingly complete pipeline rather than hiding rows. It has an explicit manual refresh (unrestricted realtime was previously removed) and a clear notice for **250-row cap / no realtime**. No stage writes are enabled.
4. Added **25** fast-CI tests in `security/build127/offline-import-guard.test.mjs` and `security/build127/candidate-board-completeness.test.mjs` (first fast run **502/502 PASS**). Fixed scorecard noninflation regression tests follow.
5. Both fast and guarded CI workflows exercise the new test coverage. Guarded workflow deliberately retains `production-release-hold`; a red aggregate run due **only** to this deliberate check must not be called fully green.

## Limitations and security

- Preview checks are file-local; they do **not** verify existing CRM duplicates, foreign keys, roles or acceptance of live writes.
- Browser validation is defense in depth only; approved Postgres policies, grants, real hosted role-matrix UAT and independent release acceptance remain mandatory.
- The 250-row candidate-board cap prevents silent omission but means the board refuses to show larger authorized data until a secure paginated/aggregate design is accepted.
- Parsing inputs still runs within the application browser and is not a security certification of XLSX parser internals; extension and size limits constrain normal exposures.
- Tests do not justify creating users, installing RLS, enabling imports or changing production data.

## Release blocker readback

- GitHub `main`: **not protected**; rulesets: **0**; PR #12: draft and unmerged, **0 independent reviews**; PR #15: open and unmerged, **0 independent reviews**.
- Dedicated Supabase nonproduction lab: **ACTIVE_HEALTHY**, 19 public base tables with RLS enabled; **0 hosted Auth identities, 0 public policies, and 0 table rows** on latest read-only verification.
- Fixed 43-gate score: **26/100 (12 evidenced, 31 open, 74 unearned)**. Protected merge readiness: **0/8**. Signed hosted UAT **0/140**; 48 production fixes **0 accepted**; release signoffs **0/9**.
- Admin-only GitHub protection and independently approved PR #15 / lab credential environment are the first deployment-path actions. This connector does not offer branch-protection or protected-secrets configuration. Blanket authorization is not a substitute for genuine independent approval.

## Next technical sequence

1. Verify exact final-head fast CI, guarded CI substantive jobs and Vercel status.
2. Protected `main`, independent PR reviews and protected nonproduction environment readback.
3. Only then, launch lab-only 9-user/38-record rehearsal, signed 140-case hosted UAT and production-equivalent RLS remediation review.
4. Independently accept PITR/restore, legal/privacy/HR/finance controls and nine release signoffs before merging/deploying.

No estimate is a guarantee. Formal build count declines only as the independent fixed milestones close.
