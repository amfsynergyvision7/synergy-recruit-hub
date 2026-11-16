# Build 63 — CI regression repair, read-only live catalog baselines, hosted-UAT false-pass protection

**Mode:** DRAFT / REVIEW-ONLY / STRICT PRODUCTION RELEASE HOLD. No migration files, hosted test fixtures, CRM writes, financial activation, or `main` merge were executed.

## Verified starting problem
Build62 GitHub Actions run [43186582386](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43186582386) finished **28 substantive jobs successful**, **one substantive `build54-guarded-candidate-release` failure**, and the separately deliberate `production-release-hold` failure. The build54 job log proves test #6 failed because its profile and `user_roles` reads bypassed the `safeHttp` wrapper. This is an actual regression, not a release-policy failure.

## Implemented in Build63
1. Route ALL profile and `user_roles` reads through the same fixed-origin, path/method-restricted and `redirect: "error"` transport used for GoTrue login, user verification, candidate RLS reads and anonymous reads.
2. Anonymous candidate preflight now counts **only empty 200 array or explicit 401/403** as denial. **404 (missing table), 5xx, malformed 200 and unexpected status all FAIL**. Avoid misclassifying an unseeded project or outage as successful anonymous protection.
3. Extend synthetic tests for 401/403 versus 404/500 and static source verification that direct `http()` exists only within the guarded wrapper.
4. Add repeatable count-only readback SQL for the dedicated nonproduction project and production metadata, with a no-DML contract test; wire this test and the Build63 path filter into the existing guarded CI.

## Same-day count-only Supabase readbacks (12 Nov 2026, UTC)
- Dedicated healthy non-production project `dhlhlasnaapzckjyvffn`: **0 hosted Auth users**, **0 public CRM tables**, **0 public RLS policies**, **0 public functions**; migration history lists 2 migrations. It is **NOT** currently capable of genuine hosted GoTrue candidate UAT.
- Live healthy production project `wusntntcqgtpgokggdzv`: **67** public RLS policies, **19** public tables with anonymous TRUNCATE, **13** public views, **13** views without `security_invoker=true`, **19** public tables. These baseline numbers are **not improvements**; actual remediation is **0/48** as of latest formal acceptance.
- Readback was aggregate metadata only. No private candidate, customer, payroll, billing or identity rows were retrieved. The two SQL files here reproduce the counts without mutation.

## Release-critical actions still blocked
- Prepare the dedicated hosted UAT schema and at least 3 distinct non-production Auth identities (admin, approved recruiter, pending), two separately owned **invented** candidate fixtures, additional historical 140-case roles/fixtures, real browser/API test evidence, independent acceptance. No production records cloned; do not insert fixtures until the separate signed data-access/migration gates permit it.
- Resolve ownership/duplicate-joined finance triggers, fee/tax/uniqueness, service-role compatibility, candidate retention/deletion/merge; obtain appropriate legal/finance decisions.
- Production-equivalent protected backup/PITR and restore/roll-forward validation (the Build60 disposable `pg_dump` recovery does not satisfy this); independent PR/security reviews; enforce branch protection; all nine formal release gates.
- No `main` merge, production/staging writes, deployment, invoice activation, bulk candidate import/deletion, or external communications.

## Formal counters and provisional forecast
Live production remediation **0/48**; independently accepted hosted auth/browser/API **0/140**; signed release gates **0/9**; entire Command Center formally accepted workstreams **0/6**. No defensible overall software-completion percentage can be derived from these counts.

**Conditional remaining estimate:** approximately **6–10+ substantive builds to secured CRM `main` merge** and **16–28+ builds including CRM to close all six Command Center workstreams**. These estimates assume access to hosted fixtures, independent reviewer and owner decisions; they are NOT money/bills, deadlines or a guaranteed countdown.

Build63 source and CI results must be pinned to their **latest own GitHub SHA and run**; do not reuse Build60/61 test numbers.
