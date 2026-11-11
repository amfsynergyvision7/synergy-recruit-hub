# Build 38 — Source-shaped RLS and grant-containment review

STATUS: REVIEW-ONLY / RELEASE HOLD. Nothing in this directory is an active migration.

## What actually passed in the nonproduction rollback lab
- Fifteen production-derived private table shapes, 200 source column definitions from read-only information_schema.
- The exact 31-policy draft from PR #11 file security/build2/full-rls-replacement-review-only.sql (source blob 1e0d751c144a9ef951e74332b5d7dce4cb51dd5c), embedded in the synthetic lab fixture with BEGIN/COMMIT replaced by a single outer rollback-only transaction.
- 135 synthetic role/table visibility scenarios for Admin, Recruiter A, Recruiter B, Finance, Operations, pending, inactive, Viewer and unknown IDs.
- Five additional synthetic writes: own candidate stage allowed, cross-owner update denied, reassignment rejected, self-role escalation rejected, Finance invoice write rejected.
- Result 140/140 source-draft synthetic checks PASS. The lab verified ROLLBACK left no candidate table.

## New companion SQL design (not a release migration)
- Revoke TRUNCATE, REFERENCES, TRIGGER and MAINTAIN from anon/authenticated/PUBLIC for 16 named tables, as these are outside RLS protection.
- Revoke PUBLIC/anon rights on 15 private tables; narrow authenticated candidate, job and notification UPDATE columns.
- Preserve only three allowlisted public app_settings branding columns. Public SELECT * and other application behavior need compatibility review.
- A separate rollback-only nonproduction suite verified the same 16-table grant behavior, recruiter ownership column denial and branding projection.
- CI uses a disposable PostgreSQL 17 container and does not connect to Supabase.

## Explicitly not counted toward formal acceptance
- 140/140 NEW synthetic source-shaped role checks are distinct from the 140 historical signed-user/API/browser acceptance cases: those remain **0/140 accepted**.
- The targeted production security objects remain **0/45 remediated**, with **0/9 release gates passed**.
- The fixture covers table shapes and policy SQL but not actual production constraints, triggers, function implementation bodies, views, full permissions, real Supabase JWTs or API/browser behavior.
- Admin UI status changes, real recruiter edit operations, scheduler and trigger compatibility, safe schema rollback and independent review require further work.
- Do not merge or deploy without those verifications and recorded release approval.
