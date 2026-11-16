# Build185 — cross-schema audit-writer inventory, metadata only

**16 November 2026. DRAFT/REVIEW ONLY. CRITICAL PRODUCTION HOLD.**

This source adds one extended, read-only, metadata-only catalog inventory across PostgreSQL non-system namespaces. The previous source-pinned Build162 writer inventory searched only public/private. The new query scans **all non-system routines** and reports literal matching function identifiers, trigger references and view dependency identifiers without reading any audit, candidate, email or CRM rows. It is **not** a full business writer inventory, authorization, change order or migration.

## Actual connected database readback (16 Nov 2026)

| Scope | Production | Isolated nonproduction |
|---|---:|---:|
| Non-system routines scanned | 158 | 142 |
| Literal audit_logs routine references | 0 | 0 |
| Matching triggers | 0 | 0 |
| View dependencies | 0 | 0 |
| audit_logs effective anon rights | 8/8 | 0/8 |
| audit_logs effective authenticated rights | 8/8 | 0/8 |
| audit_logs effective service_role rights | 8/8 | 8/8 |
| Permissive PUBLIC ALL audit policy | Present (1) | Absent |
| Trusted named reconciliation routine | Absent | Absent |

**This is NOT evidence that the audit log has no writers.** Dynamic SQL, linked helper routines, external applications, service keys, HTTP/API calls, jobs, imports, replication, historical trigger versions and untracked operational processes cannot be cleared by this metadata query. The 158 and 142 figures are point-in-time inventory counts, not acceptance percentages.

## Work to be completed by independent owners before live containment

1. **DBA/security:** inventory every audit producer, including direct app/server calls and provider/event callbacks, with operational owner, action, role, affected record type and rollback consequence.
2. **CRM/email engineering:** trace reconciliation, reserve/settle, candidate/assignment, sync and financial journal behavior; verify audit append-only changes do not break them.
3. **DB operations:** obtain independently accepted backup/PITR and restore test; identify emergency containment and a safe, coordinated revert.
4. **Security/UAT:** test authenticated real-role read and append-only behaviors using authorized fictional records; complete the existing hosted test plan.
5. **Repository/release owner:** protect main, obtain qualified independent PR approvals, and execute a separately authorized controlled change, followed by metadata readback and incident monitoring.

Source query: [audit-writer-cross-schema.readonly.sql](./audit-writer-cross-schema.readonly.sql). The five originally reviewed DO-NOT-APPLY SQL source blobs remain byte-identical and unexecuted. This build has **zero** accepted milestone changes: Category C 6/10, programme 26/100, 12/43 accepted, 31 open. No hosted writes, no policy revocation, no merge/deployment, and no external communication.
