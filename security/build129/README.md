# Build 129 — Admin-only integration boundary and owner-complete notifications

**Scope:** Draft PR #12, no merge/deploy/hosted database writes. Completed engineering in this build is distinct from the 43-gate formal acceptance rubric.

## Security changes implemented

1. **Google integrations page**: the prior `if (role && role !== "admin")` condition permitted unverified `null` role to mount React Query hooks and issue server requests before session hydration. It is replaced by an exact signed-in subject/profile/status/active/admin check; only then is the `AdminIntegrationWorkspace` mounted. Existing server `requireSupabaseAuth`, `assertAdminUser` and external-effect release holds remain mandatory.
2. **Per-account query isolation**: integration settings, sync logs, cache writes and invalidations use `["integration", userId]` or `["sync-logs", userId]` keys; account and role changes unmount the keyed workspace. This is browser-side defense in depth and does not authorize server-side access.
3. **No unnecessary polling**: removed ten-second background polling for private sync history (six requests per minute per open admin tab). A manually controlled `Refresh history` button replaces the poll. The interface now accurately says external sync is paused rather than incorrectly claiming it runs every two minutes.
4. **Settings page**: profile/branding data are mounted only for an active approved account, with subject/role-keyed inner state. An inflight admin folder setting read cannot repopulate a later session; affected frontend storage/DB errors are generic.
5. **Notifications**: formerly a 100-row limited owner-filtered fetch could silently hide records above 100 or show `No notifications` on failed read. Now it requires an exact result count, valid unique IDs, correct user owner and non-truncated result; overlapping reads abort, and failures are visibly distinguished from a verified empty inbox. The existing owner-scoped realtime event filter and exact acknowledged mark-read operation stay intact.
6. **Tests**: `security/build129/private-admin-settings-gates.test.mjs` and `security/build129/notifications-complete-owner.test.mjs`. Historic Build117 notification source assertion updated to match stronger abort condition, with no application guard regression.

## Release-critical blockers, not credited as closed

- **GitHub:** `main` unprotected, zero repository rulesets, PR #12 draft and unmerged, PR #15 unmerged; zero independent review submissions for either.
- **Nonproduction lab:** `dhlhlasnaapzckjyvffn` ACTIVE_HEALTHY; 19 RLS-enabled public tables, zero hosted Auth users, zero public table rows and zero public RLS policies (read-only verified).
- **Hosted acceptance:** 0/9 Auth identities, 0/38 fixture rows, 0/140 independently signed UAT, 0/48 production remediation acceptance, 0/9 release signatures.
- **Deployment:** Vercel preview deployment READY results exist only on older intermediate SHAs; no exact Build129-final READY verified. A Vercel status `failure` with plan build-rate-limit must not be called a passed deploy. An accidental preview is not a production release.
- **Formal programme:** 26/100 fixed weighted points, 12 of 43 gates evidenced, 31 open, 74 points unearned; protected merge 0/8. No formal acceptance has advanced with this source-only build.

## Concrete owner handoff — close blockers rather than cycle indefinitely

**Repository administrator:** protect `main` with substantive required checks, independent approval, no bypass or force-push. Configure and confirm a genuinely protected nonproduction GitHub Environment `amf-nonprod-auth-review` with an independent reviewer, protected-branch restriction and isolated nonproduction-only secrets; do not use production credentials. This connector cannot apply these policies or inspect all environment protection data.

**Independent reviewer:** inspect and approve the *small*, release-enabler [PR #15](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15) against its exact source SHA, then review the larger [CRM PR #12](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/12) in tractable sections. Source-automated tests do not constitute an independent review.

**Lab/UAT owner:** once all gates pass, use PR #15's protected, manual, nonproduction-only workflow; first `AUDIT_ONLY`, then reviewed nine fictional test Auth accounts and 38 inert rows; do not count success until actual readbacks. Independently sign 140 hosted UAT cases, then accept 48 production remediations, backup/restore evidence and nine release signoffs. A generic blanket authorization cannot stand in for a separate independent reviewer.

## Verification requirements

- Both fast and guarded CI must run on the *same final Build129 SHA*. The full guarded workflow deliberately includes one failed `production-release-hold` job; report substantive jobs separately.
- Previous Build128 553/553 fast tests and 36/37 guarded jobs (sole hold failure) are the starting baseline.
- Do not infer deployment readiness from CI, a successful preview on another SHA, or untested browser-only changes.

**Release posture:** maintain all mutation, sync, finance and production holds; do not merge, deploy or provision hosted secrets until real independent approvals and guarded hosted evidence exist.
