# Live metadata batch verification — 2026-11-10
Status: READ-ONLY EVIDENCE / SECURITY HOLD / NOT RELEASE APPROVAL

## Scope and method
Read-only PostgreSQL catalog SELECTs against connected AMF Synergy Vision production Supabase project and read-only security-advisor inspection. No business rows, credentials, function bodies or customer records retrieved; no SQL writes, migration, deployment or policy changes. Counts are point-in-time, not evidence of exploitability.

## Production catalog checks
| Test | Observed |
| --- | ---: |
| public base tables | 19 |
| public views | 13 |
| views without security_invoker=true | 13 |
| anon SELECT on public views | 13 |
| SECURITY DEFINER functions | 16 |
| anon EXECUTE on those definer functions | 16 |
| policies with literal true USING or WITH CHECK | 16 |
| broad 'Allow all for authenticated' ALL policies with true predicates | 15 |
| tables with RLS enabled | 19 |
| tables with RLS disabled | 0 |
| RLS tables with no policies | 1 |
| definer functions with no proconfig settings | 2 |

All 19 historical table names and 13 historical view names matched the current catalog inventory. All 16 historical SECURITY DEFINER function names and argument signatures matched the catalog inventory. No private function source or record data was committed.

## Current advisor findings
- 13 security-definer view findings
- 16 anonymous-executable SECURITY DEFINER function findings
- 4 mutable-search-path findings (includes functions outside the 16 definer-function inventory)
- 1 RLS-enabled table without a policy: candidate_stage_history
- 1 extension-in-public finding: pg_net
- Other advisor findings should be reviewed in the dashboard; this summary is not a claim that the above is exhaustive.

## Connected non-production database suitability
The connected non-production Supabase project was inspected using catalog SELECTs only: **0 public application base tables, 0 public views, 0 public SECURITY DEFINER functions, 0 public RLS policies**. It is **not** schema-equivalent to production. Do not run migration/rollback or role-based database tests there under the current no-staging-write restriction.

## Verified versus blocked
- VERIFIED: point-in-time object counts, names/signatures, RLS presence, broad policy exposure, effective anon view SELECT and function EXECUTE, and advisor categories.
- NOT VERIFIED: complete current schema column/default/constraint compatibility, per-role negative tests, app browser flows, trigger-side-effect compatibility, reversible migration on an equivalent database, backup restore and rollback, independent review and production authorization.
- CI green on prior isolated branch commit `3d665795`; CI for this documentation-only evidence commit is separate.
- The nine release-evidence flags remain false. Production release stays HOLD.

## Follow-on batch
1. Prepare a **local/disposable, synthetic, production-schema-equivalent** database without importing business rows; reconcile column/constraint/function/trigger dependencies.
2. Run negative tests for anon, pending/inactive, recruiter A/B, operations, finance, viewer and admin across SELECT/INSERT/UPDATE/DELETE, views, RPC, exports and ownership changes.
3. Rehearse actual restore and reversible migration in disposable environment with evidence checksums.
4. Obtain independent security review and explicit CEO release authorization. No merge, deploy, staging/production writes or financial activation until authorized.
