# Build 64 — hosted 135-case read-only acceptance harness (DRAFT / RELEASE HOLD)

## Scope and source traceability
- Reuses the exact **135 historical signed read cases** in \`security/build41/signed-http-135-read-matrix.json\`, 9 synthetic identities × 15 production-shaped historical tables. The harness insists on **135 unique sequential case IDs** and a complete subject/table cross-product.
- **Five write cases** remain disabled. They are historically designated as:
  - B42-GOTRUE-WRITE-136 — approved recruiter updates owned candidate stage in disposable database;
  - B42-GOTRUE-WRITE-137 — recruiter cross-owner candidate update denied;
  - B42-GOTRUE-WRITE-138 — recruiter unauthorized owner reassignment denied;
  - B42-GOTRUE-WRITE-139 — user-role elevation denied;
  - B42-GOTRUE-WRITE-140 — direct finance invoice write denied.
- These five are covered by prior disposable tests, **not** by this hosted runner. Do not run them against live production, ordinary staging, or any project containing real records. A separately approved isolated fixture and independently witnessed write acceptance is required.
- The matrix is from the **historical 15-table / 31-policy fixture**, not a guarantee that a later production 19-table / 67→35-policy migration matches it. A reviewer must reconcile old expected counts and all four added tables with the final release candidate. Neither 135 simulated passes nor a matching pre-seeded hosted fixture automatically closes 140 formal cases.

## Nine hosted synthetic test identities (matrix order)
| Slot | Historical fixture role and status | Secure env prefixes |
|---|---|---|
| 01 | Admin, approved/active | AMF_UAT_CASE_01 |
| 02 | Recruiter A, approved/active | AMF_UAT_CASE_02 |
| 03 | Recruiter B, approved/active | AMF_UAT_CASE_03 |
| 04 | Finance, approved/active | AMF_UAT_CASE_04 |
| 05 | Operations, approved/active | AMF_UAT_CASE_05 |
| 06 | Recruiter role with pending profile | AMF_UAT_CASE_06 |
| 07 | Recruiter role with inactive profile | AMF_UAT_CASE_07 |
| 08 | Viewer, approved/active | AMF_UAT_CASE_08 |
| 09 | GoTrue user without a corresponding profile/role | AMF_UAT_CASE_09 |

Each slot needs **EMAIL** and **PASSWORD** only in an approved secrets manager. Store \`AMF_UAT_SUPABASE_URL\` and \`AMF_UAT_ANON_KEY\` there too, never in the repository or a chat. The \`AMF_UAT_SYNTHETIC_135_FIXTURE_ACK\` must exactly equal:

\`I_CONFIRM_NINE_SYNTHETIC_HOSTED_IDENTITIES_AND_EXACT_135_CASE_FIXTURES\`

Do not provide this acknowledgement unless all nine users and the **exact synthetic table rows and role mappings** are already separately approved and provisioned. Before running, compare actual source-candidate schema, fixture triggers, table grants and expected row counts with the historical matrix. Never import production identities/candidate/customer/billing data as fixtures.

## Execution and governance
1. Provision an independently permitted **dedicated nonproduction** Supabase project with exact synthetic-only fixtures through a reviewed migration and account setup process. This Build64 task does **not** authorize or perform provisioning. Do not run a live UAT attempt against the currently empty hosted project.
2. A reviewer places the 9 test-user credentials and publishable key in an approved secure environment; the runner only accepts \`https://dhlhlasnaapzckjyvffn.supabase.co/\`, never another host.
3. Invoke \`node security/build64/hosted-135-readonly.mjs\` from the project root after authorized setup. The runner uses POST only for GoTrue password sign-in and GET for GoTrue identity verification and the 135 table reads. Redirects fail closed, each network call times out, and every response must be a complete HTTP 200 array of the expected count. On any mismatch, the program exits nonzero.
4. Preserve the output JSON in an appropriately access-controlled, immutable evidence repository only after manual review. It includes case IDs, expected/observed counts and statuses, **not** row contents, tokens, emails, actual test-user UUIDs, or passwords.
5. Real hosted read-only case outcomes are **provisional evidence** until independently reviewed, attested, and reconciled to the full 140-case acceptance matrix; \`formally_accepted_cases\` remains **0** in generated evidence. The five write cases need their own approved, isolated acceptance execution.

## Current read-only live facts (reverified Build63/Build64)
- Dedicated nonprod project: **0** hosted GoTrue users, **0** public CRM tables, **0** public RLS policies, **0** public functions (read-only catalog).
- Live production: **67** public RLS policies, **19** tables with anonymous TRUNCATE privilege, **13** non-invoker public views; security advisor also reports **16** anonymous-executable SECURITY DEFINER functions and **4** mutable function search paths. These findings remain unresolved in production. See Supabase security advisor documentation for each item.

## CI evidence and release hold
The Build64 GitHub CI job uses only mock HTTP, with invented identities and no credentials. It checks complete 135-case evidence, bad row counts, 404/500/malformed API replies, forbidden hosts, missing test-fixture authorization and duplicate/misidentified sessions. CI success is **not** live hosted testing. Retain \`production-release-hold\`, DRAFT PR #12 and no \`main\` merge, production/staging SQL writes, new financial operations, external communications, or candidate-data download.

**Forecast from Build63 carried forward:** 6–10+ additional substantive builds to a secured CRM \`main\` merge; 16–28+ additional builds for the six-workstream Command Center, conditional on genuine UAT fixtures, decisions, recovery sign-off, reviewers and nine release gates. Counts are not financial bills or committed dates.
