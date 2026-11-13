# Build 116 — CRM identity boundary and logo upload hardening

**Branch:** draft PR #12 only. PR #15 remains frozen for external independent review.

## Implemented changes

1. Account-bound CRM rendering: src/lib/crm-shell-access.ts requires the current signed-in user ID, approved+active matching profile, and a verified app role before mounting any private CRM page, search, records, or sidebars.
2. Identity-keyed shell: src/routes/_app.tsx remounts the full CRM component tree on account changes, preventing previous users' confidential search results, lists, forms, and notification badge state from remaining displayed.
3. Owner-scoped notifications: only count notifications with the current user_id; filter realtime subscriptions by that same user; ignore out-of-order count results and remove channels when the user changes.
4. Logo byte verification: src/lib/logo-upload-safety.ts and src/routes/_app.settings.tsx refuse SVG and non-raster content; require a real PNG, JPEG, or WebP signature, matching MIME and 1–2MB size before the browser attempts a storage write.
5. Run seven direct Build116 regression tests in the fast no-secrets CI workflow and trigger both PR CI workflows on the changed privacy-sensitive files.

## Security limitations

Client checks and image signatures are defense-in-depth, not substitutes for server-side storage authorization, content validation, RLS, identity-bound API checks or independent reviewer approval.
Existing SVG assets are not modified; no real candidate data, external service credentials or financial flows are touched. No production or staging writes, GitHub protected merge, deployment, UAT signature or governance approvals are implied.
