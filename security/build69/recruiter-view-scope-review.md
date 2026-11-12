# Build 69 — five recruiter-view role/active-state correction proposal

**REVIEW ONLY — do not execute. Not a deployable migration, not a policy approval, and not a change to production.**

The source-verified live inventory `recruiter-view-scope-audit.json` reports five public views with an `approved` profile-status predicate but **no explicit recruiter-role filter and no `is_active` predicate**:

1. `available_recruiters`
2. `recruiter_performance`
3. `recruiter_performance_with_names`
4. `recruiter_stats`
5. `recruiter_summary`

That means an approved admin, finance, operations or viewer profile *can qualify under the source WHERE condition*, and a formerly active but still-approved recruiter can qualify too. The actual API result also depends on the caller's grants and policies; no production business rows were read to establish which people appear today.

## Proposed scope predicate for human approval

This is a **fenced illustrative SQL proposal, not executable repository SQL**. A recruitment owner and independent security reviewer must approve semantics, review actual role grants, source fingerprints, and verify browser compatibility before drafting an executable migration.

```sql
-- PROPOSAL ONLY. DO NOT RUN.
-- Available recruiter view preserves its current four output columns.
CREATE OR REPLACE VIEW public.available_recruiters
WITH (security_invoker=true) AS
SELECT p.id, p.full_name, p.email, 'Available'::text AS status
FROM public.profiles AS p
WHERE p.status = 'approved'::public.user_status
  AND p.is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = p.id
      AND ur.role = 'recruiter'::public.app_role
  )
ORDER BY p.full_name;
```

For the other four views, **retain the existing selected columns, metrics, joins and ordering**, but review adding the same role/active predicates to their existing `WHERE p.status = 'approved'::public.user_status` clauses. Do not replace a live view's output schema or its source SQL without full fingerprint, app-consumer and RLS review. A role EXISTS check must not grant broader read privileges or sidestep `security_invoker=true`.

## Required acceptance, all currently outstanding

- A fully approved, active recruiter A and recruiter B appear as expected; recruiter-specific candidate metrics remain correctly scoped.
- Approved users with `admin`, `finance`, `operations` or `viewer` roles do not appear as recruiters.
- Pending, rejected or inactive recruiter accounts never appear.
- Admin browser dashboards, candidate assignment filters, joins and `user_roles` RLS grants work under the final hardened invoker-view rules.
- An independent reviewer re-fingerprints **all 13** affected source view definitions and reviews integration with Build49 and **Build59**. Build59's existing view source fingerprint `a90d4a1fab9552d47697127888e10d19` was computed before this proposal and **must not be silently changed or bypassed**.
- No security signoff, hosted acceptance, `main` merge, production write, staging write or financial activation occurs as a result of this document.

This review-only proposal has no effect on the existing `0/48` accepted production remediations, `0/140` real hosted cases or `0/9` signed security gates.
