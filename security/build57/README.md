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
