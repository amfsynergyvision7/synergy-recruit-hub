# Build 133 — Workflow-rule browser hold, least-data CRM queries, and count-complete activity timeline

**Scope:** Draft PR #12 only. No merge to `main`, hosted Auth account creation, nonproduction or production database write, deployment, rule activation, candidate-stage transition, invoice activation, external communication, or independent self-signoff.

## Verified starting evidence

Build132 final draft SHA `fc578aaca8cd9da3abe6cf08e19b319cd706e57a`: fast CI `43582042660` **678/678 offline + 11/11 independent finance/candidate safety tests passed**, plus real application Vite build and TypeScript success. Guarded `43582042651`: **36/37 jobs succeeded**, with only deliberate `production-release-hold` failing. Formal acceptance ledger **26/100** (12/43 accepted, 31 open); protected-merge readiness 0/8.

## Actual engineering changes

1. **Workflow Rules**: `src/routes/_app.workflow-rules.tsx` previously rendered authoring controls during null/unknown role and contained client-side `insert`, `update`, `delete` and activation toggles. Replaced the entire authoring UI with an exact-approved-Auth-subject **administrator-only** review. Private workspace is keyed by current user and role, with abort-on-unmount and manual refresh. Rule creation, editing, activation, deactivation and deletion controls and write calls are entirely absent.
2. `src/lib/workflow-rules-review.ts` defines an **unconditional** browser write hold and strictly validates the narrow, exact-count source response before presentation. Its projection contains no message template, notification title, creator identity or other extraneous workflow fields. It reconciles all allowed RLS-visible pages up to 2,500 records; malformed/count-incomplete reads fail visibly.
3. **Important distinction:** removing browser rule writes **does not disable existing database triggers, active rules, or direct API writes**. The underlying hosted source has no accepted rule-trigger/RLS/grant audit. A production approval must independently investigate triggered candidate/finance effects and install reviewed server-side holds. The code author has not run any SQL mutation to stop them.
4. **Shared CRM**: new `src/lib/crm-read-projection.ts` produces minimal, canonical, reviewed module/table data selectors using declared form, search, email and sort fields. Preserves candidate `updated_at`, ATS issues and resume summary required by existing UI; preserves interview scheduling token/slots. Excludes UI-only fields `client_resume`, `scheduling_link`, `careers_link`, rejects dynamic expressions/aliases, and disallows `select("*")` fallback in relation selectors. Server RLS and column grants remain independently authoritative and **not accepted**.
5. **Admin activity timeline**: `src/routes/_app.activities.tsx` replaces the unverified `limit(200)` history with exact count and ID-ordered 250-row pages to an absolute 2,500. Complete rows are sorted newest-first locally. Failures/over-cap reads do **not** render a fictitious empty timeline or count; request aborts when account/role changes.
6. **Tests:** new `security/build133/workflow-rule-readonly.test.mjs`, `crm-projection-minimization.test.mjs`, `activity-timeline-completeness.test.mjs`, `scorecard-progression.test.mjs` cover admin gating, zero browser writes, malicious projection identifiers, bounded page reconciliation, false-empty prevention, and unchanged formal release gates. Historical Build125/128/131 source tests were updated for stronger, not weaker, safety contracts. The fast and guarded workflow test lists contain Build133 coverage.
7. **Acceptance provenance:** frozen Build132 historical record `security/release-progress/build132-evidence-baseline.json`; Build133 live evidence `security/release-progress/current.json`. An offline test or this draft change cannot self-accept hosted RLS or production financial gates.

## Isolated lab observation — 14 Nov 2026, read-only

Project `dhlhlasnaapzckjyvffn` status **ACTIVE_HEALTHY**; **19/19** public base tables with RLS enabled; **0** public RLS policies, **0** Auth users, **0** enabled public app triggers. Separate read-only SQL `count(*)` across all 19 public tables confirmed **exactly 0 rows**; the isolated lab contains no actual 9 identities or 38 fictional records. This does not prove the CRM role access model, nor any live business data safety.

## Actual release blockers

| Gate | Latest read-only evidence | Required responsible actor |
|---|---|---|
| Protected main (REL01) | `main` unprotected, rulesets 0 | GitHub repository administrator enables required PR reviews, required substantive CI checks, force-push and bypass controls; independently verifies |
| Nonprod Auth PR (REL02) | PR #15 open, unmerged, 0 submitted independent reviews | Independent reviewer approves exact head; admin verifies protected PR merge |
| Dedicated nonprod environment | Protected independent reviewer and secrets not verified | Authorized GitHub environment owner sets `amf-nonprod-auth-review`, prevents self-review, isolates lab secrets |
| Hosted synthetic bootstrap (CRM06–07) | 0/9 Auth users, 0/38 inert fixture rows | Approved lab owner performs manual `AUDIT_ONLY` then reviewed fictional Auth and fixture setup |
| Signed hosted UAT (CRM08) | 0/140 accepted cases | UAT/security reviewer signs 135 signed-read + 5 controlled signed-write cases |
| Production permission remediation (CRM09) | 0/48 accepted | Production DB/security owner reviews 19 table privileges, 13 views, 16 privileged functions |
| Release/operations (CRM05/10, REL03–07) | PR12 draft/unreviewed, no protected merge, 0/9 signoffs | Independent reviewers, recruiting/legal/privacy/finance, backups/PITR and release owners |

No credentials, live customer records, actual production rules or production configuration were accessed. Do not interpret code-only status as hosted acceptance.

**Formal programme score:** **26/100**, **12/43 evidenced**, **31 open**, **74 points remaining**. New code is real but does not automatically close any independently signed gate. Protected-merge readiness still **0/8**.

**Next highest-value path:** obtain independent repository protection and PR15 review, then protected lab-only Auth fixtures and signed hosted tests. Large PR #12 is 760+ commits and needs a separately assigned independent reviewer; code authored by ChatGPT must never certify its own release.

**CI policy:** Build133 must pass exact-final-head fast real build/typecheck and all substantive guarded jobs; deliberate production-release-hold must stay failed. A prior or intermediate green commit is not final-head evidence. Vercel build-rate-limited combined status is not an accepted deployment.
