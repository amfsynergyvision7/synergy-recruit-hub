# Build 48 — The 67-policy authorization gap and corrected release proposal

**REVIEW ONLY / RELEASE HOLD.** No staging/production or persistent hosted-test writes.

Live read-only catalog has **67 policies across 18 tables**. Removing the 15 universal ALL=true RLS policies leaves **52 old permissive policies**, including "read candidates" and "read bill" allowing any approved user. With PostgreSQL's OR semantics, this could defeat the newer recruiter-scoped policies. Build 47's synthetic 15-policy fixture could not reveal this.

This build adds an exact source-policy snapshot, a 67-policy source replay fixture and a revised *review-only* migration that checks the original catalog fingerprint, applies the 48-object lockdown, removes the 52 leftover policies and replaces the entire RLS set with 35 proposed policies: 31 from PR #11 and four conservative proposals for app_settings, candidate_stage_history, email_log and workflow_rules. The new 67-policy integration test first demonstrates the old cross-recruiter and billing leak, tests fingerprint mismatch failure, then checks scoped access and restores its synthetic transaction with ROLLBACK.

**Compatibility remains unapproved.** These are engineering proposals, not AMF business policy. Administrative role/profile updates, workflow rule management, recruiter email access and stage history operations may require new privileged workflows. Full live function bodies, triggers, UI calls, production backup/restore and genuine hosted Auth sessions remain untested by this fixture.

Release counters remain **0/48 actual production objects remediated, 0/140 real hosted Auth/browser/API cases accepted, 0/9 formal gates passed.** Independent security review and protected main remain outstanding. No merge, live import, billing activation or production deployment.

## Build48 disposable emergency-recovery rehearsal

The read-only 32-object ACL and 16-function EXECUTE snapshot is retained as `live-acl-catalog.json`. A separate `unsafe-legacy-restoration-disposable-only.sql` reconstructs the exact original 67 RLS policies plus the recorded table/view/function grants and view security options. It requires an explicit disposable-test setting; restoring the baseline would **reopen vulnerabilities** and is NOT recommended production rollback. The independent `unsafe-recovery.integration.sql` test applies the tightened controls, reconstructs the insecure original permissions, verifies their fingerprint and then rolls the whole synthetic transaction back. A safe production release still needs an approved roll-forward plan and full backup/restore acceptance.
