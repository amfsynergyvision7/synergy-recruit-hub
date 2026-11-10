# Recruiter assignment trigger metadata and ownership risk — 2026-11-10

Read-only production catalog inspection confirms `public.set_assigned_recruiter()` is SECURITY DEFINER, `proconfig=NULL`, and executes:

```sql
IF NEW.assigned_recruiter IS NULL THEN
  NEW.assigned_recruiter := auth.uid();
END IF;
RETURN NEW;
```

This trigger provides a **default only**, not authorization. If an INSERT supplies a non-NULL `assigned_recruiter`, the function preserves it without checking whether the caller may assign that recruiter. The missing fixed search_path is additional hardening debt, although this function uses `auth.uid()` qualified and has no unqualified table reference.

**Design-only next step:** enforce permitted recruiter assignment on INSERT and UPDATE using table-specific authorization rules and/or a carefully scoped trigger that checks the authenticated principal, admin roles and active/approved recruiter status. Verify legitimate manager reassignment, admin onboarding, background imports and automated creation paths before selecting a policy. Do not blindly force every record to `auth.uid()`: legitimate privileged assignments may require another owner. Audit update policies for changes to `assigned_recruiter`, not only INSERT defaults.

Also confirmed `public.set_updated_at()` is SECURITY INVOKER (`prosecdef=false`), has `search_path=public`, and sets `NEW.updated_at=now()`. No privileged-function search_path issue identified for this helper.

No production changes, no business-row reads. All nine release gates blocked.
