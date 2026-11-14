# Build 126 — Privacy-safe offline import and candidate-board completeness

## Baseline and scope

Build 125 fixed v1 score: **26/100**, 12/43 evidenced milestones. Build 126 is a draft-only application-security build on PR #12; it does not close the remaining 31 formal acceptance gates. No database schema, policy, Auth user, fixture, SMTP, AI provider, Vercel environment, `main`, staging, production or financial workflow is changed by this source batch.

## Changes implemented

1. The bulk importer now mounts only after the current Auth subject, approved and active profile, and verified administrator role agree. The workspace is keyed by Auth subject, so uploaded file state is unmounted on a user switch.
2. Import preview now validates **only local uploaded file content**. It does not read `profiles`, `user_roles`, `candidates`, `clients`, `job_openings` or any billing table. It identifies duplicate keys **within the uploaded file**. UI explicitly warns that existing-record collisions, foreign keys, recruiter eligibility and production import safety are **not verified**. The unconditional `LEGACY_BULK_IMPORT_WRITES_PAUSED` release hold is unchanged.
3. Candidate route refuses to mount until the Auth account/profile/role are consistent and approved. It looks up only recruiter-role IDs and their active/approved profile labels, using 150-row exact-count limits, duplicate-role rejection, request abort and failure-closed selection. It does not retrieve the employee email directory.
4. Candidate board uses exact counts, stable ID order, a 250-row cap, duplicate-ID detection, request epochs, abort on unmount and explicit incomplete-data failure. It removes unfiltered realtime subscription events. The stage-change write hold remains active. This bounded client board is **not** an approved large-dataset aggregate or a replacement for RLS.
5. Regression coverage is `security/build126/import-and-board-privacy.test.mjs`, wired into both fast and guarded CI; the guarded production-release-hold job is retained.

## Known limitations

- A 250+ row candidate dataset will fail closed in the board; BI02 must implement role-safe and audited server aggregates/pagination before signoff.
- The importer is an offline review tool, **not** a valid existing-record or foreign-key preflight. No hosted users or live candidate data were used in these source tests.
- UI route guards are defense in depth only. Real security depends on approved server-side RLS, grants, signed role-matrix UAT and independent review.
- Exact CI results must be read from the final commit workflows; an in-progress, canceled or deliberately blocked workflow must not be reported as fully passing.

## Release actions still blocking acceptance

- GitHub admin: protect `main` with required substantive checks, independent review and bypass restrictions; verify readback.
- Independent qualified reviewer: review PR #15, then draft CRM PR #12, and record the applicable approvals.
- Repo admin: configure the protected nonproduction credential environment for PR #15 using lab-only credentials; then conduct isolated hosted 9-user/38-row setup, 140 signed UAT, 48 production remediations review, backup/PITR exercise, and 9 formal signoffs as applicable.
- Do not merge or deploy on the strength of draft source tests or user blanket authorization. Maintain the explicit release hold until requirements are actually evidenced.

**Fixed scorecard:** 26/100, 31 open milestones, 74 unearned points. This is not a time estimate.
