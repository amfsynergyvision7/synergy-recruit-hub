# Build 50 — Legacy Browser Mutation Containment and Hosted Acceptance Handover

**Review branch only — production, hosted test database, and `main` remain unchanged.**

## Implemented in this draft

1. Introduced unconditional presentation-layer holds for legacy candidate create/edit/delete, single/bulk changes, and candidate stage board drag/drop; the controls also guard their asynchronous handlers against stale or unexpected UI callbacks.
2. Removed all direct row-by-row `insert`/`update` writes from Excel/CSV import. Mapping and preview still work, but the execution button is disabled and the handler has no database writer.
3. Removed the direct candidate `DELETE` call from duplicate cleanup. Duplicate review remains available; delete action is disabled.
4. Added an independent source-contract CI job that catches reintroduced client writes or a missing production hold.
5. These changes explicitly trade legacy write functionality for release safety in the review branch. They are **not** a compatible substitute for an audited candidate mutation RPC, a reviewed atomic import API, or backend enforcement. Do not merge them blindly.

## Actual compatibility gaps not fixed

- Candidate CRUD, stage movement, duplicate cleanup and Excel/CSV bulk import now deliberately cannot execute from this draft UI. Restoring workflows requires approved server-side commands with narrow permissions, explicit role policies, mandatory auditing and independent end-to-end acceptance.
- A PostgreSQL trigger may auto-create billing records at the `joined` stage. Build45's hold is only a review proposal. Neither this client hold nor the draft SQL protects the existing production endpoint.
- Other CRM modules may still contain direct DML that conflicts with the 67-to-35 RLS replacement. Notably status/priority for jobs, notifications, workflow rules, reporting, AI summary/ATS persistence, and manual data operations still need real-role/browser testing.
- No real signed-hosted sessions are available in the isolated security test project, so **0/140** formally independently accepted historical authorization scenarios remain unchanged. CI synthetic test counts cannot be substituted.

## Formal hosted UAT execution order

1. Obtain controlled synthetic accounts through the hosted Auth administrative console: one active approved admin, two separately assigned approved recruiters, one pending applicant, one suspended account and an anonymous session. Use unique synthetic emails, no candidate or customer PII, strong single-purpose credentials stored only in a protected test environment.
2. Recreate the approved migration candidate in a **dedicated disposable nonproduction clone** after independent review; verify exact 67-policy fingerprint and 48-object grants before any changes. Current clean test project contains zero RLS policies and zero hosted Auth accounts, so it is not already ready for the historical 140-case matrix.
3. Run **140/140** historical browser/API authorization cases with actual signed user sessions: allow and deny expectations, cross-recruiter isolation, anonymous access, inactive and pending denial, role changes, direct DML blocks, views and functions. Capture request IDs/statuses and sanitized case IDs, never JWTs, passwords, emails or resume fields.
4. Separately run functional compatibility on candidate creation and edit, bulk import, duplicate delete, stage changes, account approval/role updates, notifications, email logging, workflow rules, ATS, and billing. No release sign-off while these operations are intentionally paused or fail under approved roles.
5. Run production-equivalent backup/restore and rehearse **safe roll-forward recovery**, never reintroduce the original permissive policies as a live rollback. Attach named independent reviewers and decision records.
6. Enable `main` branch protection only with actually green required checks and explicit human review. Because `production-release-hold` deliberately fails, do not set it as a required check that is silently bypassed; document the review release policy and remove the hold only after all nine gates close.

## Acceptance accounting

- Draft engineering change: this build records new source changes and CI evidence only.
- Actual production security-object remediation: **0/48**; hosted 140-case acceptance: **0/140**; formal security release gates: **0/9**.
- Production release: **HOLD**. Business Command Center workstream closure: **0/6 formally accepted**.
