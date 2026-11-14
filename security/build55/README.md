# Build55 — Candidate Deletion Impact / Foreign-Key Hazard (REVIEW ONLY)

The current production database has **11 candidate-linked FK constraints**, of
which submissions, interviews, offers and stage history **CASCADE DELETE** and
billing foreign keys **SET NULL**. Permanent candidate deletion can therefore
destroy recruitment history while silently detaching billing references.
The current CRM hard-delete and duplicate-merge workflows must remain paused.

`candidate-delete-impact-review-only.sql` proposes a strictly READ-ONLY,
admin-authenticated `crm_candidate_delete_impact(uuid)` that returns only
dependent-table counts and `allowed_to_delete:false`; no names, emails,
salary, invoices or resume contents are logged or returned. The function
uses `auth.uid()`, the approved active admin role, an existing candidate
row lock and scoped counts; it performs **no DELETE** and grants only EXECUTE
to authenticated users. The counts are advisory transaction snapshots,
not an approval or full retention-impact analysis (loosely linked history
can exist without foreign keys).

`candidate-fk-fixture.sql` reproduces the real CASCADE/SET NULL relationship
shapes, and role-aware disposable PG17 tests check admin/pending/recruiter/
suspended/anon access, PII-free counts and no mutation. A dangerous legacy
DELETE is demonstrated **only inside a caught nested exception subtransaction
and a surrounding ROLLBACK**.

No hosted staging/production writes, migration activation or candidate deletion
is approved. Separate legal/retention/finance sign-off is still necessary.

## Production FK and trigger fingerprint

A *read-only* live catalog query on 2026-11-12 found exactly **11 candidate-linked foreign keys**, MD5 `84fe09e127229b017c85b05d9a49da21`; and exactly **7 candidate triggers**, MD5 `b0d55f339dc38c0a2efd61dfe82f0b6a`. `live-dependency-preflight.sql` returns `MATCH_READ_ONLY_NOT_RELEASE_AUTHORIZATION` only for those exact definitions and `DRIFT_BLOCK_RELEASE` otherwise. It is SELECT-only and is not a substitute for approved backup or hosted Auth tests. Regenerate the baseline through fresh read-only production inspection before any later authorized deployment.
