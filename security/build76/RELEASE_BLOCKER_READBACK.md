# Build 76 — Verified release blocker readback and handoff (13 November 2026)

**Status:** DRAFT / HOLD. **No production or staging changes, no hosted schema/account changes, no merge or deploy.**

## Live facts verified this build
- PR #12: open, draft, unmerged; head `13258a4ccb6e5da582ec0e5157dc9da85053d047` before this evidence commit; independent reviews: **0**.
- Repository default branch `main`; GitHub repository rulesets endpoint returned `[]`. Branch protection endpoint returned HTTP 403 for current integration; **do not equate this with a positively established protection status**.
- Dedicated nonproduction Supabase project `dhlhlasnaapzckjyvffn`: ACTIVE_HEALTHY. Read-only SQL at build time: **0** `public` base tables, **0** `public` views, **0** `public` functions, **0** `public` application triggers, **0** `public` RLS policies, **0** Auth users and **0** custom `auth.users` triggers. Consequently Build75 preseed safety prerequisite **HOLD**.
- Nonproduction Security Advisor returned five informational `rls_enabled_no_policy` notices in *non-public* laboratory schemas (one `amf12_policy_decision_lab`, four `security_lab`). Review authorization/exposure separately; not evidence that CRM public tables exist.
- GitHub connector supports PR/code/issue updates but **not branch protection configuration**. Supabase connector here supports SQL and project metadata but **not GoTrue/Auth Admin createUser**. Direct SQL Auth-user insertion is excluded.

## Critical path, in executable order
1. **Isolated hosted infrastructure owner:** independently review 19-table source-shaped schema, 13 invoker-safe views, complete RLS/ACLs and 32 trigger definitions. Prevent all outbound email, sync, webhook and billing side effects. Confirm no copied production email-conditioned admin bootstrap trigger.
2. **Provisioning gate:** implement approved migration in this *nonproduction project only*; run `security/build75/isolated-hosted-preseed.readonly.sql` and independently verify **technical PASS**. The first successful nonproduction schema provision will change **infrastructure readiness**, **not** the 0/140 signed-UAT counter.
3. **Auth owner:** create nine invented `example.invalid` GoTrue identities with a server-side Auth Admin pathway and secret manager. Keep exactly eight profiles/roles and one unprofiled/unroled negative subject; run `security/build75/isolated-hosted-postseed.readonly.sql`. Do not log user secrets or copy production data.
4. **UAT:** run signed sessions on 135 historical reads; execute five historic writes only after disposable-mutation authorization; cover current 19-table views/functions/browser pathways and positive/negative/anonymous cases. Collect exact per-case artifacts and independent sign-off; count only actually accepted cases.
5. **Release governance:** repository admin configures and positively verifies `main` ruleset/branch protection; independent reviewer approves PR; security/recovery and HR/finance/legal owners sign off; recovery test measures RPO/RTO. Do **not** disable the intentional production-release hold just to make CI green.
6. **Production:** only after preceding gates, individually review and apply 48 remediations through approved migration/rollback process; separately approve release and deployment. Keep billing activation and consequential candidate mutations held unless independently authorized.

## Formal acceptance at this readback
| Gate | Accepted | Meaning |
| --- | ---: | --- |
| Live production security remediation | **0/48** | Not installed/accepted |
| Independently accepted hosted historic cases | **0/140** | Test prerequisites absent |
| Signed security release gates | **0/9** | No independent sign-offs |
| Closed six-workstream programme acceptances | **0/6** | Not completed |

**Forecast:** A calendar date and finite number of builds are not supportable while the Auth Admin provisioning path, environment design, independent reviewer, and recovery/signatories remain unfulfilled. Conditional working range after those are supplied: **5–10+ substantive CRM release iterations and 15–30+ for the full programme**. Do not reduce this range for documentation/CI-only work.

Evidence reference: GitHub PR #12, issues #13/#14; Build75 read-only SQL and synthetic fixture blueprint. This document records connector readback, not independent auditor attestation.
