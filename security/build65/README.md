# Build 65 — hosted UAT identity-integrity gate and 19-table coverage reconciliation

**Mode:** DRAFT / REVIEW-ONLY / NO LIVE DATABASE WRITES / STRICT RELEASE HOLD.

## Actual engineering changes
1. The 135-case historical read runner now pins the exact original matrix's **nine synthetic subject IDs** and **135 row-count expectations**. A changed expectation is rejected before making any HTTP requests, so a softened matrix cannot silently turn a failed security test green.
2. Before executing the 135 reads, the runner requires **18 additional read-only fixture checks**: exact own `profiles.id/status/is_active` and `user_roles.user_id/role` for nine real GoTrue sessions. This covers admin, two recruiters, finance, operations, pending recruiter, inactive recruiter, viewer and no-profile user, and fails closed on privilege/ownership mismatch.
3. Synthetic CI tests challenge wrong profile status, wrong profile owner, wrong role, wrong role owner, changed source identity, changed expected row count and existing 135-case negative scenarios.
4. A read-only metadata comparison confirms that the historical 135-case runner checks 15 of the **19** current production public tables. `production-hosted-coverage.json` records the four missing tables (`app_settings`, `candidate_stage_history`, `email_log`, `workflow_rules`) and 13 production public views absent from the historical hosted table matrix.
5. `coverage-contract.test.mjs` verifies the manifest against the unchanged Build41 matrix and guards against counting historical read-only results as all-scope release acceptance. The existing Build64 CI job runs these Build65 tests, retaining the separate 32-job aggregate and deliberate production release hold.

## Strict evidence distinctions
- **Offline mock passing:** evidence the runner's logic works against invented API replies; NOT genuine Supabase hosted-user authorization.
- **Future hosted 135-case results:** only provisional read-case evidence, requiring exact reviewed synthetic fixtures, actual hosted Auth users, human review and independent sign-off. The five write cases remain deferred.
- **Production-wide acceptance:** must additionally cover four missing current tables, 13 public views, the current security-function inventory, the exact source-pinned full policy replacement, browser CRM behavior, financial holds, backup recovery and signed governance gates. The hosted historical 135-case runner alone can never satisfy these requirements.
- No identity data, candidate rows, payroll records or billing data were copied from production; this Build65 scope uses public-schema names and aggregate counts only.

## Last live count-only metadata snapshot (12 November 2026)
- Dedicated nonproduction project `dhlhlasnaapzckjyvffn`: **0** actual Auth users, **0** public CRM tables, **0** public RLS policies. Hosted UAT fixtures therefore remain absent.
- Production project `wusntntcqgtpgokggdzv`: **19** public tables, **13** public views; the earlier read-only baseline found **67** existing public RLS policies, **19** anon-TRUNCATE-table grants, and **13** non-invoker views.
- This is a metadata snapshot; rerun read-only catalog preflight immediately before any eventual migration or formal acceptance. The code does not use or expose user credentials.

## Critical path and gate counters
- Provision independently approved **synthetic-only nonproduction** schema, nine hosted GoTrue users and exact fixture rows under controlled migration/access authorization; verify no real candidate, client, contact, payroll, tax or invoice data copied.
- Independently execute and sign actual 135 hosted read cases and five separately permitted write cases; add tests for four missing production public tables, thirteen views and function grants; perform browser/API route compatibility UAT.
- Resolve legal, finance/fee/tax/invoice-uniqueness and candidate-retention decisions; production-equivalent backup/PITR and roll-forward testing; independent security/code reviewers; protect `main`; close all nine formal security gates.
- **UNCHANGED FORMAL COUNTERS:** production remediation 0/48; accepted genuine hosted cases 0/140; signed security gates 0/9; signed six-workstream completion 0/6. No reliable weighted overall completion percentage.
- **Conditional remaining estimate:** approximately 6–10+ substantive builds for secured CRM `main` merge, 16–28+ additional builds for full Command Center including CRM. Dependent on external approvals/test fixtures and therefore not guaranteed or monetary.

No production/staging writes, merge, deployment, financial activation, hard deletion, external communication or release hold removal.
