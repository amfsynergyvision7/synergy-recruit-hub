# Build 2 — consolidated P0 release rehearsal and approval handover (DRAFT ONLY)

Status: **NOT AUTHORISED TO EXECUTE**. No staging credentials, business rows, production changes, merge, deployment, communications or policy activation are authorised by this document. PR #11 stays unmerged. All nine release-evidence flags stay false.

## A. Staging prerequisite and execution boundary
**Approval needed:** explicit management authorisation for a disposable staging environment and write operations there, with a named operator, permitted project ID, time window, rollback owner and approved migration artifact. Never infer that existing read-only Supabase access permits staging writes.

1. Confirm staging is isolated from production: different project, credentials, storage, auth callbacks, webhooks, SMTP, billing providers, scheduled jobs and integrations. Disable outbound notifications and financial side effects.
2. Seed **synthetic** users and candidate/client/job data only. Do not copy live candidate records.
3. Capture preflight inventories: tables/columns, policies, RLS flags, role grants, views and security_invoker settings, functions/security-definer/search_path, triggers, cron/scheduler jobs and schema migration hashes. Store dated artifacts outside the production database.
4. Review exact migration and rollback scripts with a human. Run schema migration only on the authorised staging project; do not substitute the synthetic SQL fixtures for production migrations.
5. Run deny/allow tests in section B; capture before/after database inventory, SQL exit status, CI SHA and reviewer sign-off.
6. Rehearse rollback on disposable staging; compare schema/policy/grant/function/trigger inventories to baseline and verify application smoke tests. Any mismatch blocks release.
7. Disconnect/rotate temporary staging secrets and retain approved evidence without personal data.

**Acceptance:** zero production access; no outbound side effects; complete pre/post/rollback inventory and negative tests; reviewer sign-off. A synthetic PostgreSQL rollback in CI does **not** satisfy the real staging rollback gate.

## B. Browser role-based acceptance matrix
Use distinct synthetic accounts and browser sessions. Each case requires screenshots/logs without personal information and expected-vs-actual outcomes.

| Principal | Candidate list/detail | Create/update/delete | Assignment | Stage transition | Bulk operations |
| --- | --- | --- | --- | --- | --- |
| Admin | Authorized scope only | Verify permitted actions | Verify explicit authority | Verify permitted transitions | Verify confirmations and server results |
| Active assigned recruiter | Own assigned records only | Verify allowed columns/actions | Cannot self-reassign without approval | Own candidates, approved transitions only | Only authorized own records |
| Active other recruiter | No cross-recruiter record exposure | Denied for unassigned records | Denied | Denied | Denied |
| Inactive account | Denied | Denied | Denied | Denied | Denied |
| Unauthenticated | Denied | Denied | Denied | Denied | Denied |

Additional negative tests: forged client-side role, direct PostgREST calls bypassing UI, 0-row RLS updates, request timeout after server commit, missing/partial returned IDs, concurrent single+bulk clicks, filter changes while selected, failed relation lookup, candidate switching during offer lookup, stage-trigger side effects, restricted notification/email logs and financial view exposure. No success toast may appear for an unconfirmed mutation.

**Acceptance:** actual server permissions match documented policy, no cross-tenant/cross-recruiter exposure, refresh reconciles server state, and all denied writes remain denied even with UI bypass. This matrix does not assert current implementation passes.

## C. Management decisions required before any workflow or finance activation
| Decision | Owner / evidence required | Default until signed |
| --- | --- | --- |
| Recruiter assignment and reassignment authority | Management-approved role matrix, exception and audit policy | Do not expand privileges |
| Candidate stage and submission/interview/offer workflow transitions | Management-approved field-by-field allowlist and side-effect mapping | No new privileged transitions |
| `offers.joining_status`, `billing.payment_status`, `clients.status` | Written permissions, actor and audit decisions | Exclude from privileged workflow allowlist |
| Placement fee and GST calculation, rounding and exemptions | Business owner plus qualified tax/legal review | Do not activate hard-coded stage-trigger billing |
| Failure semantics for candidate-stage triggers | Approved atomicity, retry and reconciliation rules | Do not enable consequential automatic side effects |
| Final release approval | Named authorised management signatory with independent test evidence | No merge/deploy |

## D. Evidence register to complete *after* authorised execution
For every one of the nine keys in `release-evidence.json`, attach: evidence URL/immutable artifact ID, environment/project ID, exact commit SHA, timestamp, executor, reviewer, scenario list, positive and negative results, rollback status and residual risks. Do not set a flag to true merely because an offline test passed. A final human release decision remains mandatory.

## E. Immediate safe next step
Obtain the **separate staging-write authorisation and synthetic role-test accounts**; then execute sections A and B as one controlled batch. Obtain the policy decisions in section C separately. Until then, keep release blocked and continue read-only/draft-only preparation.
