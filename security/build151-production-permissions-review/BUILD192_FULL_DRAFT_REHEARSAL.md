# Build 192 — actual 67-to-35 policy proposal replay + predicate-drift detection

**16 Nov 2026 | Strictly REVIEW ONLY — no production/staging write, no merge, no deployment, no acceptance/signoff.**

## What progressed, beyond catalogue-shape simulation

Build191 used an entirely fictional 35-policy catalogue to test its permission checker. **Build192 now executes the actual 67-to-35 policy and 48-object SQL source from existing draft PR #16** in a brand-new PostgreSQL 17 service database, with synthetically recreated table/view/function shapes and no real records. The exact reviewed SQL is Git-blob-pinned; the generator **withholds the single terminal `COMMIT`**, checks the proposal's postflight inside its transaction, and issues unconditional `ROLLBACK`. After rollback the original **67-policy fingerprint** and absence of the two new administrative RPCs are explicitly verified.

[Source-pinned replay generator](./build192-replay-actual-proposal.disposable.mjs) · [proposed policy exact-fingerprint preflight](./build192-exact-35-policy-fingerprint.readonly.sql) · [GitHub Actions #43838444413](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43838444413).

### Exact successful evidence

- The old 67-policy source snapshot was loaded against the extracted original source-shaped PostgreSQL 17 tables and view definitions. All original 67 policies compiled under the fixture; exact proposal source guard accepted their original policy checksum.
- The **actual source-pinned full proposal** ran through its 48-object grant/revocation checks, removed 15 unrestricted policies, installed 35 replacement policies and defined both proposed admin/self-profile functions in the transaction.
- The Build191 48-object / 35-policy postflight returned `REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE` in the disposable environment. **This is a catalog-shape match, not a release PASS.**
- The new exact proposed policy digest (from the disposable PG17 `pg_policies` normalized expressions) is **`632d447f4cb5b5a88777e48916e288f9`**, covering **35 policies on 19 tables**; a read-only checker requires exactly that signature.
- Deliberately changing the **`candidates_read` policy `USING` expression to `true`** kept the total at 35 and was **not detected** by the general count/permissions postflight. This is a verified *false-positive gap* if that older checker is used alone.
- The exact-policy digest immediately reported `HOLD_PROPOSED_35_POLICY_SOURCE_OR_PREDICATE_DRIFT` for that altered policy. Rolling back the savepoint recovered the original proposed policy fingerprint.
- The proposal's outer transaction was **rolled back**, the original **67** legacy policies were restored, and both proposed account RPCs vanished.
- CI has **28/28** source contracts, **25/25** independent adverse PG17 privilege/schema checks with their own rollback, and **the exact full SQL integration rehearsal PASS**. These are three distinct successful GitHub Actions jobs; no hosted database was touched.

## Mandatory combined decision

A DBA or release validator must **AND** both checks on the *same* independently authorized database state, not use either one in isolation:

1. `build191-postflight.readonly.sql` must return `REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE` to corroborate expected object/privilege *shape*.
2. `build192-exact-35-policy-fingerprint.readonly.sql` must return `REVIEW_ONLY_EXACT_35_POLICY_SOURCE_MATCH_NOT_RELEASE` to reject **same-count predicate, role, command, table, or name drift** from the source-pinned 35-policy proposal.
3. Qualified reviewers must separately approve the **policy contents themselves**, role authorization matrix, service-side/admin/audit writers, real GoTrue-hosted signed UAT, complete CRM business workflows, and verified backup/PITR recovery. Matching **two** fingerprints is only source drift protection, not proof the source is safe.

### Unresolved compatibility hazards

The source-shaped fixture includes dummy stubs for the 16 existing `SECURITY DEFINER` function bodies, a simulated `auth.uid()` and synthetic tables. The tests did **not** run real production helper bodies, signed JWTs against the 35 policies, actual data authorization outcomes, production triggers, external audit writers, email sending, CRM synchronization, billing or finance, GoTrue hosted users, full 140-case UAT or owner-approved restore. Other draft change lanes [PR #23](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/23) (role helper and audit) and [PR #18](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/18) (correspondence integrity) must be coordinated with [PR #16](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/16) before any production rollout. Do not merge a conflict-prone partial draft or authorize external effects from these synthetic tests.

**Current official programme acceptance remains 26/100, 12/43 accepted, 31 outstanding; Category C 6/10 with LD02 and LD05 awaiting independent owner decisions.** Production permission remediations 0/48 accepted; signed hosted UAT 0/140; nine go-live signoffs outstanding. Protected `main` and independent reviewer approvals are absent.

The GitHub repository is public; confidential security incident evidence, personal data and production credentials must be handled through a private authorized review channel.
