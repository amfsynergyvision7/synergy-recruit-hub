# Build 187 — caller-bound role helper (review proposal; DO NOT APPLY)

**No production or hosted staging writes. This SQL is not an approved migration.**

## Material finding

Fresh production `pg_policies` text verification (16 Nov 2026) found **41/41** policies that reference `public.has_role` pass `auth.uid()` as the first argument. **Zero** policies used another first argument in this static catalog scan. Thus the proposed function can preserve **the existing function name, two argument types, normal role-check answer for the *current* session, and all 41 policy expressions**. It is a source compatibility hypothesis, not proof about external RPC calls, dynamic SQL, background jobs or authenticated JWT integrity.

Current production `public.has_role(uuid,public.app_role)` is a `postgres`-owned `STABLE SECURITY DEFINER` function using `search_path=public`, callable by anon and authenticated. Its production SQL looks up the requested `_user_id` and role in `public.user_roles` without checking that the request belongs to `auth.uid()`. That creates a potential cross-user role-existence inference path **if a caller can invoke the exposed function**; no actual exploitation was tested or demonstrated.

## Proposed limited replacement

[Unexecuted draft](./has-role-current-user.DO-NOT-APPLY.sql.txt): retain name/signature and role-readable `SECURITY DEFINER` behavior for RLS policy recursion safety, change its search path to empty, require non-null `auth.uid()` equal to `_user_id`, bind `user_roles.user_id` to the session, remove PUBLIC and anon EXECUTE, explicitly allow authenticated. The change is *not sufficient* to remove all high-risk RLS or other exposed functions, and must not be deployed on its own.

## Actual disposable PostgreSQL 17 rehearsal

The [behavior script](./pg17-role-helper-behavior.sql) uses three **fictional** identities, synthetic user roles and two example RLS datasets inside one disposable transaction. It **executes the exact proposed SQL only there** and verifies:
- pre-patch anonymous grant exposure is reproduced;
- post-patch anon cannot invoke the helper even with a forged test GUC;
- authenticated without a session identity cannot pass role checks;
- admin can read the synthetic audit and candidate record, but not probe a different user's role;
- recruiter can see the candidate sample, but not the audit, and cannot probe a foreign admin;
- finance can see neither unrelated synthetic dataset;
- `authenticated` lacks direct SELECT on role memberships, while the guarded function works;
- the transaction is fully rolled back.

This is **database simulation**, not a verified signed GoTrue JWT, REST/PostgREST HTTP UAT, end-to-end CRM feature test, production data access proof or independently signed approval. Tests must never be run on production or an existing hosted environment.

## Mandatory release blockers

1. Independent DBA/security reviewer must review *all* 41 RLS dependencies and any non-policy RPC consumers (including possible admin roster lookup needs); determine whether cross-user lookups are ever legitimate and design separate, narrowly authorized server functions if so.
2. Independently verify current effective grant graph, function ownership, default privileges, schemas, policy precedence and any direct/inherited/foreign role execution privileges. Verify that changed semantics do not break candidate/recruitment, billing, settings, storage, admin, scheduling, integrations, audit and financial workflows.
3. Review a coordinated migration and rollback/PITR playbook with complete access-matrix and authorized hosted **fictional** real JWT/PostgREST role tests; do not simply switch the function in isolation.
4. Critical `audit_logs` policy and 8/8 effective privilege exposure, trusted reconciliation RPC absence, `main` protection, independent PR reviews, hosted UAT and release signoffs all remain blocked.
5. Keep the source-only draft and original five `reviewed/` SQL blobs isolated; DO NOT APPLY or merge/deploy merely because the ephemeral checks pass.

**Formal status:** Category C 6/10, programme 26/100, 12/43 accepted, 31 open. No milestone acceptance from this engineering rehearsal.

## Build187 confirmed compatibility preflight — same exact source SQL run on both hosted projects

The separately source-pinned [READ-ONLY policy-caller compatibility preflight](./policy-caller-compatibility.readonly.sql) removes every `has_role(auth.uid(), ...)` call in each policy expression and **refuses a REVIEW_ONLY status if any unbound `has_role(...)` invocation remains**. Live catalog results on 16 Nov 2026 were: **production 41 dependent policies, zero non-session-bound calls, helper present, REVIEW_ONLY_NO_DEPLOYMENT**; **isolated lab 38 dependent policies, zero non-session-bound calls, helper absent, explicit HOLD_NO_HOSTED_PARITY**. This corroborates that a session-bound helper may preserve the 41 statically inspected production policies without any textual policy edits. It cannot discover additional service-side RPC consumers, dynamic SQL, authorization bugs, signed JWT failures or actual production upgrade compatibility. It grants **zero** additional acceptance points.

Source checks verify that this SQL accesses only `pg_policies` and function-signature metadata and cannot mutate data. No hosted SQL beyond SELECT metadata was executed.
