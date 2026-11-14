# Build 70 — five source-exact recruiter views against disposable PostgreSQL 17

**DRAFT ENGINEERING EVIDENCE ONLY / NO HOSTED WRITE / NO MAIN MERGE / STRICT PRODUCTION-RELEASE-HOLD**

## Engineering delivered

1. `exact-live-five-view-sources.json` captures **five actual `pg_get_viewdef` expressions and their independent live catalog MD5s** from the public schema, obtained through a SELECT-only production metadata call on 12 November 2026. The complete source is checked for drift against Build69's original view fingerprints. No actual recruiter, applicant, candidate or financial rows were read.
2. `five-recruiter-view-semantics.rollback.sql` executes in a newly created **disposable GitHub Actions PostgreSQL 17 database**, NOT in hosted nonproduction or production. It starts with `BEGIN`, creates minimal invented profile/role/candidate rows, reproduces five live definitions verbatim, applies the proposed active-recruiter restriction to all five with `security_invoker=true` **only inside the transaction**, exercises authorization and schema contracts and ends with unconditional `ROLLBACK`. GitHub Actions checks that all disposable views were removed afterwards and drops the disposable database. A CI failure aborts psql with `ON_ERROR_STOP=1`; the PostgreSQL test service is ephemeral.
3. The eight profile fixtures represent admin, recruiter A/B, finance, operations, pending recruiter, inactive recruiter and viewer, with two invented recruiter-owned candidates. The live-view baseline permits **seven approved profiles** to qualify; the proposed role+active restriction should narrow to **two approved active recruiters** and preserve view projections, metric counts and column types.
4. The integration then enables **actual PostgreSQL RLS on `profiles`, `user_roles` and `candidates`**, grants a separate non-owner `authenticated` SQL role constrained SELECT rights, and uses nine invented actor UUID contexts. Proposed `security_invoker` views must expose **two recruiters for the synthetic admin, one own recruiter for either synthetic recruiter and zero for finance, operations, pending, inactive, viewer and the ninth unprofiled identity**. These are explicitly synthetic policy simulations, **not** a replay of every source production policy or genuine hosted GoTrue/browser authorization.
5. `source-replay-contract.test.mjs` checks five original/patched source references, raw MD5 values, the presence of the nine-actor role/RLS test, retained view schema, exact rollback and absence of any target hosted database reference or committed test transactions.
6. The step is integrated into the existing `expanded-public-security-contracts` GitHub Actions job, which already uses **disposable PostgreSQL 17**. No additional GitHub job is introduced, so the complete substantive review remains **32 jobs**, plus its aggregate and the intentionally failing production-release-hold. The fast offline suite checks the source contract but cannot substitute for a successful real PostgreSQL integration job.

## Why this matters

The live source audit found five recruiter-facing views that filter for approved profiles but not explicitly active recruiters or the recruiter role. An approved admin, finance, operations or viewer may therefore qualify under that WHERE clause, subject to effective privileges. Running the exact live definitions and the candidate restriction side by side against real PostgreSQL gives stronger migration compatibility evidence than a static proposed SQL patch or mocked request alone.

The invoker/RLS phase can also reveal **UI compatibility concerns**: a user who can only read their own profile and role may see fewer rows in recruiter directory and performance views. This behavior must be approved by a recruitment/business owner; it is **not** authorization to change the production views, whether or not the integration passes.

## Explicit limitations

- No production view, trigger, RLS policy, grant, function, user or record is created/changed by Build70. The only DB writes are **invented data in a disposable GitHub Actions database**; all are rolled back and the temporary database is dropped.
- Build59's protected thirteen-view fingerprint and the existing combined release package are **unchanged**. A real view-semantic change would need a new independently reviewed source manifest, compatibility checks, and separate finance/HR/security approval.
- The separate dedicated hosted nonproduction Supabase project remains without 19 public CRM tables and nine Auth users, based on the most recent actual read-only Build69 check. **No genuine hosted UAT cases** are accepted from this offline disposable exercise.
- Formal counters remain **0/48 production remediations accepted, 0/140 genuine hosted cases independently accepted, 0/9 security release gates signed, 0/6 workstreams formally closed**, absent subsequent authorized live acceptance.
- `main` remains unprotected, PR #12 is draft and unmerged, financial workflows are on hold, and production-equivalent backup/PITR and business/legal/finance/retention signoffs remain outstanding.

**Conditional forecast:** approximately **6–10+ substantive builds** before secured CRM merge to main and **16–28+** for all six Command Center workstreams including CRM, assuming required external gates and genuine hosted tests can be completed. These figures are engineering iterations, not costs, a deadline or an accepted overall completion percentage.
