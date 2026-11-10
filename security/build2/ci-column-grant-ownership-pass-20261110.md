# Recruiter ownership column-grant regression — verified 2026-11-10

GitHub Actions run #212: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42691293397

All three CI jobs succeeded. The disposable PostgreSQL 17 fixture `synthetic-column-grant-ownership.integration.sql` passed, bringing the isolated SQL suite to **21 PASS groups**. The existing offline Node suite and application build/TypeScript check also passed.

The test grants a simulated recruiter SELECT plus `UPDATE(stage,status)` on synthetic candidates, while withholding `UPDATE(assigned_recruiter)`. It also enables ownership RLS. Verified: the recruiter cannot UPDATE `assigned_recruiter` even on their own record; can update their own candidate stage; and cannot update another recruiter's candidate. This tests a second enforcement layer distinct from RLS `WITH CHECK` and prevents accidental owner-column edits if future RLS policy composition changes.

**Not release-ready:** this is a disposable-schema example, not a validated column grant matrix for all production CRM tables. The actual application may need other fields; column-level privileges and SELECT visibility for mutation-return confirmation require source-backed compatibility checks. Admin reassignment, background automation, service roles, and the exact production table grants remain subject to approval and staging verification. No policy was deployed.

PR #11 unmerged, production unchanged, all nine release gates false.
