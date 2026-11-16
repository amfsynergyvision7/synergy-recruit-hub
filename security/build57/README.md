# Build57 — Review-only Backend Invoice Write Lockdown

## Confirmed gap
Build56's client-side billing pause and candidate/offer BEFORE joined guards do
not alone prevent direct API INSERT, UPDATE, DELETE or TRUNCATE against
`public.billing`. A read-only production query on 2026-11-12 confirmed
`anon`, `authenticated` and `service_role` have table-level write grants
on `public.billing` and `public.offers`. RLS may deny some calls, but grants
are not an adequate unconditional financial release gate.

## Draft, not deployed
`billing-write-lockdown-review-only.sql` revokes invoice DML/DDL-related
table grants from all three API roles and PUBLIC, revokes explicitly granted
column permissions for every live column, and creates an independent
SECURITY INVOKER always-fail BEFORE trigger for INSERT, UPDATE and DELETE
plus a separate statement trigger for TRUNCATE. It does not revoke SELECT,
does not alter real data, never enables billing and does not allow a GUC or
client-flag bypass. Table owner/privileged function paths are blocked by
the trigger when enabled, but a high-privilege administrator could still
alter or disable it: release governance must separately restrict schema
administration.

**Important compatibility impact:** revoking `service_role` billing DML may
break legitimate integration/billing jobs. The exact workflows and any
required audited replacement are subject to Finance/Operations review.
It is deliberately a HOLD, not a final billing implementation.

`compose-billing-lockdown.mjs` replays exact existing source-derived
candidate/offer handlers and the previously demonstrated TWO synthetic
billing rows, then installs all billing guards inside a transaction that
ROLLS BACK. Tests assert both the row/statement trigger and direct API
privilege denials, and that existing synthetic invoices remain unchanged.
The full Build54/55/56 release composer will also pin this source with
its SHA256 and test it under the original 67→35 policy transition.

No production/staging writes, real invoice reads or external messages.

## Build57 RLS policy hard-denial

The review source also changes the existing `billing_admin_write` RLS policy to `USING (false) WITH CHECK (false)`, preserving the 35-policy count and the independent admin/finance read policy. This protects against accidentally restored authenticated grants; it does not stop Supabase service-role RLS bypass or privileged owner writes by itself, so both revoked DML privileges and the two billing triggers remain required. Synthetic tests assert the false write policy and unchanged existing invoice rows.

## Live read-only privilege fingerprint & source-level bypass inventory

The source-checked production role catalog has **three API roles** with table-level billing INSERT/UPDATE/DELETE/TRUNCATE and offer INSERT/UPDATE/DELETE grants. `service_role` has `BYPASSRLS`, making RLS alone insufficient for that role. The observed deterministic grant digest is `6e19f3552ee067cf31763535f0076540`. `live-financial-grants-preflight.sql` returns `LEGACY_GRANT_SURFACE_MATCH_REVIEW_ONLY` only for that exact live surface; it reads no invoice rows. It will return `DRIFT_BLOCK_RELEASE` if the catalog differs. `financial-write-surface.test.mjs` checks current source for direct literal billing DML and enforces the generic CrudModule hold, but cannot prove the absence of dynamic, indirect or off-repository writers. Real hosted acceptance and a complete dependency review are still essential.
