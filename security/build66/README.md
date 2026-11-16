# Build66 — read-only hosted extra-scope and JWT trust-boundary hardening

**Status:** DRAFT / guarded PR review only / STRICT RELEASE HOLD. The code and mock tests do not seed any hosted account or table, do not access candidate/customer data and do not alter production or staging.

## Delivered engineering work

1. `security/build66/uat-key-gate.mjs` centralizes the requirement for a non-privileged Supabase `sb_publishable_` key or a legacy JWT key with exact `anon` role; service-role/secret and unexpected key shapes are rejected. The historical Build64 hosted 135-case runner now imports this shared validator.
2. `security/build64/hosted-135-readonly.mjs` also checks GoTrue access-token payload shape, exact `role=authenticated`, `sub=auth.user.id` and an unexpired integer `exp`. Its hosted `/auth/v1/user` lookup and PostgREST are still responsible for validating the actual token. The offline mock now uses synthetic JWT-shaped strings, with adversarial privileged, expired, mismatched-subject and malformed tokens.
3. `security/build66/hosted-anon-extra-scope.mjs` is a **20-probe, GET-only**, fixed-host anonymous API preflight. It covers 3 omitted sensitive tables (`candidate_stage_history`, `email_log`, `workflow_rules`), all 13 production public views, a one-row synthetic public-branding projection (`logo_url`, `default_color_theme`), and explicit denial of 3 private `app_settings` columns (`resume_import_folder_url`, `updated_by`, `updated_at`). Routes allow only the dedicated synthetic nonproduction project; redirects fail closed, timeouts are mandatory and raw records or credentials are never placed in results.
4. `security/build66/hosted-anon-extra-scope.test.mjs` tests synthetic 20/20 success, unexpected exposure from *each* private table/view, private branding column visibility (including zero-row HTTP 200), missing schema 404, server 500, malformed 200, mismatched branding fixtures, production host and privileged API key.
5. `security/build66/extra-public-surfaces.readonly.sql` reproduces a metadata-only 17-object public table/view ACL and security-invoker review; `extra-public-surfaces-contract.test.mjs` and `coverage-and-key-contract.test.mjs` prove it matches the earlier 19-table/13-view gap register and contains no DML/DDL. All tests are part of both the full guarded workflow and the separate fast offline feedback workflow.

## Reverified live catalog-only production facts, 12 November 2026

All four extra public tables (`app_settings`, `candidate_stage_history`, `email_log`, `workflow_rules`) currently have **RLS enabled** and are granted **anonymous SELECT and TRUNCATE**. Their current RLS policy counts are respectively **2, 0, 2, 1**. All 13 listed public views grant anonymous SELECT and **none** has `security_invoker=true`. This is catalog privilege evidence, not proof that a particular private row is visible. The prior complete production baseline remains **67** legacy public RLS policies, **19** tables with anonymous TRUNCATE and **13** non-invoker views. RLS does not protect `TRUNCATE`, so a live grant is a serious issue requiring independently reviewed remediation.

Dedicated nonproduction hosted UAT `dhlhlasnaapzckjyvffn` remains **0 actual GoTrue/Auth users, 0 public CRM tables and 0 public RLS policies**. These preflight scripts cannot yet produce real passing hosted UAT evidence. **No production or staging writes or customer data downloads were performed.**

## Test execution AFTER separate synthetic-only setup gates

- Provision independently approved synthetic-only 19-table/13-view security lab fixtures and nine real distinct GoTrue test accounts in the **dedicated nonproduction** project, using a reviewed source-verified plan. The old 135-case historical matrix uses only 15 tables and is NOT the final 19-table release acceptance. Do not clone or insert real candidate/client/finance records.
- Provide `AMF_UAT_SUPABASE_URL`, `AMF_UAT_ANON_KEY`, and `AMF_UAT_SYNTHETIC_135_FIXTURE_ACK` only in a secure test environment. The acknowledgement must be `I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES` and cannot be given while the project is empty.
- Once the **separate setup gates have been satisfied**, run `node security/build66/hosted-anon-extra-scope.mjs` for the 20 extra read-only anonymous probes; the historical 135 signed read cases and five separately controlled write cases remain distinct formal acceptance work.
- For the 16 private surfaces, an empty HTTP 200 array or explicit 401/403 demonstrates no anonymous rows in those synthetic fixtures; a 404, 5xx, malformed response, or nonempty 200 **never passes**. Private branding columns require explicit 401/403 instead of zero-row 200. The public branding projection must return exactly one synthetic row with both approved field names.
- Human reviewers must still verify grant containment, all 19 current public table permissions, the 13 views and function ACLs, the final migration, full browser route compatibility and the finance, retention and deletion policies. All 20 checks are **provisional technical preflights** and must not be added to the historic `140` formal hosted case denominator without approval.

## Remaining gates and forecast

Production security fixes **0/48 accepted**; real hosted historical cases **0/140 independently accepted**; signed security release approvals **0/9**; full Command Center workstreams formally closed **0/6**. Independent reviewer approval, branch protection, finance/legal policy decisions and production-equivalent encrypted backup/recovery/PITR remain unresolved. `production-release-hold` stays intentionally failing, PR #12 remains DRAFT and no merge or deployment occurs.

Indicative planning estimate **6–10+ substantial builds to secured CRM `main` merge** and **16–28+ builds to complete the full six-workstream Command Center**, assuming hosted fixture setup, owner decisions and independent release review become available. These are build iteration estimates, not money, a timetable or a defensible percent of total work complete.
