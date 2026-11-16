# Build 61 — hosted authorization evidence integrity (draft-only)

## Implemented
- Strengthened `security/build54/hosted-auth-preflight.mjs` to verify the **exact returned row ID** for each own-profile and positive candidate access, rather than treating a one-row response as sufficient.
- Reject recruiter fixture accounts that also expose an admin role; this catches a test identity with accidental excess privileges even if the role-based read seems to succeed.
- Added synthetic HTTP regression cases for wrong profile row, wrong candidate row, and recruiter/admin role contamination. Test stubs contain only invented UUIDs and invalid-domain accounts; no hosted user data.

## Interpretation and limitations
These edits eliminate three potential **false-positive preflight results**. They do **not** establish a passing live GoTrue session, RLS acceptance, an independently signed 140-case matrix, or production readiness. Until CI completes for this SHA, the tests are **added, not CI-verified**.

## Release governance
Keep PR #12 draft; PR #11 superseded; no `main` merge, staging/production SQL writes, deployments, financial activation, candidate downloads, or external communication. Hosted UAT still requires separately provisioned approved synthetic users and fixtures plus human acceptance review. Formal gates unchanged: 0/140 accepted hosted tests, 0/9 signed release gates, 0/48 applied live remediation controls.
