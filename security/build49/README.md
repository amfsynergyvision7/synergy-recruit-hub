# Build 49 — Audited Account Administration and Self-Profile Compatibility

**DRAFT ONLY / PRODUCTION RELEASE HOLD.**

## Release-blocking application regressions addressed

The original CRM User Management page directly updated `profiles.status`, `profiles.is_active`, deleted all `user_roles` and reinserted a role from the browser. The full 67-to-35-policy release correctly revokes direct authenticated profile/role writes; consequently, the old admin approval/suspend/role UI would fail.

Build49 adds a review-only `crm_admin_manage_user(p_target,p_operation,p_value)` PostgreSQL SECURITY DEFINER function, deriving the actor solely from `auth.uid()` and verifying the acting account is approved and active with admin role. It serializes all administration changes with a transaction advisory lock, refuses self changes, protects the final approved administrator, enumerates status/activation/role changes, replaces role records atomically and inserts a privacy-limited audit record **in the same transaction**. Audit insert failure rolls back the role/profile mutation.

The browser now uses one narrow `supabase.rpc('crm_admin_manage_user',...)` action instead of several direct writes. The UI shows actions as paused until `VITE_CRM_USER_ADMIN_MUTATIONS_ENABLED=true` is explicitly configured following release review; the helper independently denies requests while the flag is unset. The SQL RPC is authenticated-only, not callable by anon.

Similarly, `crm_update_own_profile` restores the Settings page's profile name/phone/department edit without reopening table-level UPDATE privileges or permitting status/role modifications. It reads user ID only from `auth.uid()`, bounds text lengths and logs only changed field names (no PII values). Browser profile editing remains paused until `VITE_CRM_PROFILE_MUTATIONS_ENABLED=true` is formally approved.

## Evidence and limitations

- Standalone synthetic SQL rollback tests reproduce approved-admin, recruiter, suspended-admin, self-lockout, invalid operation, role replacement and audit-failure rollback, plus profile field restrictions and pending-user self-edit. These passed in the dedicated hosted *nonproduction* PostgreSQL transaction. **These do not create real GoTrue users or constitute hosted Auth acceptance.**
- A larger source-shaped PostgreSQL fixture exercises both RPCs **after the exact current 67 legacy policies are replaced by the proposed 35 restrictive policies**, verifying direct browser DML denied while new server-privileged functions continue working. Also passed in a rollback-only hosted nonproduction transaction.
- The `67-policy-plus-account-rpcs-review-only.sql` file composes the policy hardening and two compatibility RPCs into one proposed transaction, still **NOT an active migration**.
- 0/48 actual production security objects remediated, 0/140 hosted independently accepted authorization tests and 0/9 formal release gates. Main remains unprotected, PRs draft, independent reviews absent. The seven missing live business decisions/acceptance categories remain outside this code patch.
- The old CRM user model renders one effective role, but `user_roles` schema permits multiple memberships; management must approve whether replacing all memberships is correct. Status changes/role assignment remain consequential actions and should retain a separate human approval and an audit trail.
- Test-only SQL uses synthetic JWT-sub settings, not a real signed browser session. These new runtime workflows remain disabled by default. A genuine hosted user/browser test and approved migration are needed to turn them on.

**No production/staging DB writes, account updates, merge, financial workflow activation or live imports in Build49.**
