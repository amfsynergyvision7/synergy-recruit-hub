# Isolated hosted Auth Admin and 38-row UAT fixture — independent release-enabler

**Scope:** Dedicated nonproduction Supabase project `dhlhlasnaapzckjyvffn` ONLY. This PR is cut from unchanged `main` and contains only a small, manually initiated hosted identity/fixture harness; it does **not** merge CRM draft PR #12, apply RLS policies, modify production, deploy to Vercel, send messages, charge candidates, or enable financial/recruitment workflows.

## Why this is an actual release-critical dependency

As of 13 November 2026, the dedicated nonproduction Supabase project has **zero** Auth users and zero source-shaped fixture rows. **0/140** real signed hosted UAT cases can be accepted without actual GoTrue identities. Existing Build78/79 scripts in 470-commit draft PR #12 were fully prepared and tested offline, but could not be invoked through the Supabase management connector (no Auth Admin `createUser` action). A Vercel environment metadata audit found a production-scoped `SUPABASE_SERVICE_ROLE_KEY`, but **no separately provisioned nonproduction Auth Admin credential**. **NEVER** reuse or copy the production key.

This self-contained, smaller PR makes the required isolated **actual Auth Admin operation** executable under a restricted GitHub Actions environment once reviewed and configured. It preserves the source-reviewed Build78/79 fixtures with operation-guarded stages, then verifies real hosted cardinalities.

## Exactly what can run

The manually triggered `Nonprod Synthetic Auth UAT — Manual Only` GitHub Actions workflow has two operations:
- `AUDIT_ONLY` (default): uses the isolated project's Auth Admin API to count Auth users and 19 public tables; does not create users or write rows.
- `CREATE_NINE_AND_SEED_38`: refuses unless **all 19 tables and Auth users are exactly empty**, creates exactly **nine** confirmed `@example.invalid` GoTrue accounts through `supabase.auth.admin.createUser`, assigns 8 invented profiles/roles and 2 invented recruiter-owned candidates, verifies the 18-row intermediate state, adds **20** invented inert entries across the other 16 tables, then verifies **nine Auth users and exactly 38 public rows**. No email invites are sent. All fixtures have synthetic names/addresses, disabled automation, zero billing, no real job offers or mail delivery, and no live candidate data.

Every operation enforces an exact project ID/HTTPS URL, server-side service/secret key format, manual confirmation, GitHub main-only dispatch, repository actor check, and independent workflow environment. Neither pull requests nor Git pushes can trigger the credential-bearing operation. The PR test job has **no secrets** and cannot provision users. A partially failed run cannot silently rerun over unexpected users or fixture rows; inspect and reconcile the dedicated lab before any retry. No user IDs, passwords, API keys or source personal data are printed or uploaded as artifacts.

Nine strong per-user test passwords are derived **deterministically with HMAC-SHA256** from one protected, random 64+-character `amf_uat_master_...` secret. The secret is never printed or saved to source, and can be reused later by an independently approved signed HTTP UAT runner. The resulting password is different for each synthetic account. The hosted operation therefore requires only **two environment secrets** rather than ten.

## Required independent human/security setup (not done by this PR)

**1.** Have a repository administrator create a GitHub environment named exactly `amf-nonprod-auth-review` under Repository → Settings → Environments. Configure an independent required reviewer/approval on the environment wherever the repository's GitHub plan permits it. Make sure an independent security reviewer has approved this small PR **before it is merged**. Do not treat the author's review or a general ChatGPT approval as independent sign-off.

**2.** In that environment only, securely add two secrets:
- `AMF_NONPROD_SERVICE_ROLE_KEY` — a dedicated service/secret key issued **by the isolated Supabase project `dhlhlasnaapzckjyvffn`**, never the production key; do not paste it into chat, a GitHub issue, a file, a PR comment, or an ordinary Vercel production variable.
- `AMF_UAT_PASSWORD_MASTER_SECRET` — a high-entropy random value in form `amf_uat_master_` followed by **at least 64 random base64url characters**, stored **only** in that protected GitHub environment. This is a test-only secret, not a customer password, not an existing candidate credential.

**3.** After small-PR independent review and authorized merge to `main`, open GitHub → Actions → **Nonprod Synthetic Auth UAT — Manual Only** → Run workflow. Select `AUDIT_ONLY` first; confirm zero users and zero fixture records with independent read-only Supabase metadata, including zero enabled application triggers and no live customer data. Then select `CREATE_NINE_AND_SEED_38` and type this exact literal confirmation:
`EXECUTE_9_GO_TRUE_AND_38_INERT_ROWS_ONLY_IN_dhlhlasnaapzckjyvffn`.

**4.** Confirm 9/9 actual Auth accounts and 38/38 hosted fictional rows via fresh Supabase read-only tool query; do not count them until the actual user/row records exist. Separately approve and apply only the reviewed 15 RLS SELECT policies and execute 135 genuinely signed GoTrue HTTP read cases plus five controlled write cases. Until then **signed UAT remains 0/140**, even if fixture setup succeeds.

If GitHub Environments' required-reviewer protection is unavailable on the current plan, **do not silently run the sensitive operation unreviewed**. Use a separately secured operator environment with equivalent independent access controls or obtain suitable plan access. Do not create a public privileged Edge Function endpoint or write `auth.users` directly.

## Safety and evidence

- Original fixture source reviewed and tested in Builds 78–81; 38 invented rows and 135 read matrix passed actual disposable PostgreSQL17 constraints and RLS tests. The three copied source scripts here preserve those exact guards and table plans (one relative import adjusted for self-containment).
- This PR uses GitHub Actions `contents:read` permission, independent workflow environment secrets scoped only to the manual job, `npm ci --ignore-scripts` before secrets are present, and no write-enabled GITHUB_TOKEN.
- `release-gate.test.mjs` verifies project allowlist, strict confirmation, derived passwords, exact three-stage cardinalities, reject-on-nonempty Auth, no automatic trigger, no accidental production credential reference, and inactive fixture states.
- **Do not merge main CRM PR #12 as part of this setup.** The production release hold, 48 production remediations, nine release approvals and all programme workstreams remain independently blocked.
- A manual failure **after** user creation can leave nine isolated test users in the nonproduction project. This is deliberate fail-closed behavior rather than an unsafe broad automated account delete. Reconcile users/fixtures before retrying.

### Planning impact

This turns the recurring "missing Auth Admin tool" excuse into an independently reviewable executable path. It does **not** yet complete the credential setup, independent reviewer assignment, actual account provisioning, fixture insertion, hosted UAT or production deployment. Those are separate verifiable actions. The existing 5–10-build CRM countdown was not evidence-based; use milestone/gate completion instead of inventing a smaller number.

**Evidence of current baseline (read-only 13 November 2026):** nonproduction Auth 0/9, hosted fixture 0/38, signed UAT 0/140, production security remediations 0/48, approved release gates 0/9; main unprotected and no independent reviewers. Do not represent creation of this PR as any of those counters having advanced.


## Build 88 — Live 19-table readiness audit and enforced independent gate

The full read-only SQL artifact is `build88-hosted-preflight.readonly.sql`. It is explicitly scoped to the **dedicated isolated nonproduction project**. It was **actually run via the approved connected Supabase management SQL tool on 13 November 2026** and returned `ready_for_reviewed_synthetic_provisioning = true`, with **19 expected public tables and zero actual fixture records**. The audit independently verified **zero Auth users, zero enabled public app triggers, zero enabled noninternal Auth-user triggers, zero public application RLS policies, zero non-forced-RLS public tables, zero unapproved anonymous/authenticated grants, zero exposed public views/functions**, and **zero missing service-role SELECT/INSERT/DELETE privileges for any of the 19 tables**. This is a *read-only preflight*, **not** actual Auth provisioning, policy installation, or signed UAT. Its result must be rechecked freshly immediately before any manual write.

**Additional mandatory runtime gates.** For `CREATE_NINE_AND_SEED_38` (not for `AUDIT_ONLY`), the workflow requires the exact additional `preflight_confirmation`:

`I_REVIEWED_FRESH_NONPROD_SQL_19_EMPTY_ZERO_AUTH_TRIGGERS_GRANTS_POLICIES`

This is an *operator attestation of a freshly rerun read-only SQL check*, not an automated live SQL verification by GitHub Actions. The runner and its underlying writer independently reject missing preflight acknowledgement and unexpected users/table cardinalities; they cannot certify triggers or grants without the separate SQL review.

Before accessing either protected Supabase secret, `independent-release-approval.mjs` also performs read-only GitHub API checks requiring: the exact original **PR #15** independently **APPROVED at its current head SHA and merged**; a genuinely separate non-bot reviewer with collaborator/member/owner association (author self-review is rejected); no outstanding independent `CHANGES_REQUESTED`; and a **protected, unchanged `main` branch** at the manual dispatch SHA. If any prerequisite is missing, the GitHub job exits before the later secret-bearing step. The GitHub token is scoped to read-only repository/PR access; no production secret is supplied. These source checks supplement—do not replace—the GitHub Environment's required-reviewer settings.

**Current real blocker:** GitHub `main.protected=false`, PR #15 is unmerged and has no independent approval, and the two nonproduction-only secrets have not been verified as configured. The connected GitHub integration cannot update repository branch protection or confidential GitHub Environment secrets. A repository administrator must enable main protection and protect the manual environment; a separate collaborator must review and approve the small PR. **Do not merge until reviewed.**

### Operator sequence that changes actual counts

1. An authorized repo administrator protects `main` (review + status checks) and configures the `amf-nonprod-auth-review` GitHub Environment with independent approval and the **two lab-only** secrets. Never paste production keys in this chat.
2. An eligible independent reviewer approves the *exact current source SHA* of PR #15; only then may an authorized administrator merge the small PR into protected `main`.
3. Dispatch `AUDIT_ONLY`, rerun the read-only SQL audit, verify every preflight result is zero or otherwise as specified, then—only with fresh evidence—dispatch `CREATE_NINE_AND_SEED_38` with both literal confirmations and any required environment reviewer approval.
4. Verify in the real nonproduction Supabase Auth and tables that **9/9 identities and 38/38 invented records** now exist. Until that happens, counters remain **0/9 and 0/38**. Signed UAT still starts at **0/140** and requires reviewed RLS, genuine signed sessions and separately controlled writes; production release controls remain untouched.

This project should be measured by **verified movement of those milestones**, not by treating each code build as one fewer release build.


### Build 88 actual live hosted preflight — source-pinned count/ACL pass

The read-only file `build88-hosted-preflight.readonly.sql` was **actually executed** through the connected Supabase management SQL action on project `dhlhlasnaapzckjyvffn` on 13 November 2026. Exact source blob SHA `e1fe6dbe22724135baa93c1aae75f927fdaab4cd`. It returned `ready_for_reviewed_synthetic_provisioning=true` after checking **19/19 present, forced-RLS tables with zero rows**, Auth users 0, application RLS policies 0, enabled app/Auth-user triggers 0, public caller grants 0, publicly callable application functions 0, exposed public views 0, and service-role fixture table privileges fully present. The safe count-only observation is committed in `build88-live-preflight-observation.json`. **This is a verified hosted preflight PASS, not actual 9/38 seeding or signed UAT acceptance.**

### Private-repository GitHub plan limitation (verify before prescribing setup)

GitHub's current documented plan rules may block the stated environment/branch protection configuration on a **private** repository. GitHub Free personal accounts support branch protection and environments primarily in public repositories; private branch protection and private environment secrets require an eligible paid plan, while built-in environment **required reviewers** are generally limited to public repositories on Free/Pro/Team plans. **The account's actual GitHub plan has not been confirmed; do not assume either plan or paid entitlement.** See [branch protection plan rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches) and [environment protection plan rules](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

For eligible private repositories, source-level `independent-release-approval.mjs` independently enforces a protected `main`, the exact `PR #15` merged, and a fresh non-author collaborator review **before** the secret-bearing write step, whether or not the plan offers a protected-environment review gate. **Do not make the repository public simply to obtain Free protection features**: the CRM source and business logic are not approved for publication. If the private-repository plan cannot provide protected `main` and the two scoped secrets, this GitHub Actions path remains on HOLD; use only a separately secured, independently reviewed operator environment with equivalent controls. This is an administrator/account-plan decision, not something ChatGPT may bypass.


### Build 89 exact 30+2 trigger provenance — ACTUALLY VERIFIED in hosted lab

The previously prepared strict Build75 checker `security/build75/isolated-hosted-preseed.readonly.sql` was **actually executed, read-only**, against the dedicated nonproduction Supabase project `dhlhlasnaapzckjyvffn`. It reported **HOLD**: 19/19 tables and 13/13 invoker-safe views were present, all 32 application triggers were disabled, but **30/32** application trigger *and function* hashes matched the original production source. The only differences are two `public.candidates` trigger functions. Both nonproduction function bodies have `SECURITY DEFINER SET search_path TO ''`; `track_stage_changes` additionally qualifies `public.candidate_stage_history`. Both are non-callable by `anon` and `authenticated` and remain disabled as table triggers. Their trigger *definitions* still exactly match production. Replacing the two hardened functions with less safe production definitions is **not appropriate**.

New `build89-hosted-preseed-two-hardenings.readonly.sql` leaves the historical Build75 checker **unchanged**. Its expected fingerprints permit the **30 exact unchanged trigger/function pairs plus only the two explicitly pinned hardened pairs**, while requiring all 32 disabled, both hardened functions private and `search_path=''`, zero Auth bootstrap hooks or users, RLS and security-invoker view constraints. The new SELECT-only check was **actually run against the live isolated Supabase project** and returned **`TECHNICAL_PRESEED_30_EXACT_PLUS_2_HARDENED_PASS_NOT_PROVISIONING_PERMISSION`** with **32/32 exact allowed trigger/function pairs and 2/2 verified hardened private functions**. A deliberately corrupted expected hash in a separate read-only rehearsal produced **31/32 matched and correctly returned HOLD**. These facts are pinned in `build89-live-hardened-preseed-observation.json`.

To attempt a future independently approved hosted provisioning, an authorized reviewer must inspect **both** the independent Build88 no-grants/no-fixture check and the new Build89 precise two-variant source audit. The GitHub manual workflow still has its existing independent-review, protected-main and exact preflight attestation hold; no change to that privileged configuration was completed in Build89. **No Auth user, fixture record, policy, external message, financial action, or production object was written.** Passing the technical schema source check is **not** an independent sign-off, GoTrue-signed UAT, merge authorization or release approval.


## Build 90 — reviewed-source lock and execution serialization

Repository visibility was rechecked on 13 November 2026: **public**. The earlier private-repository plan warning is a hypothetical caveat, not this repository's current visibility. On current GitHub plans public repositories are eligible for protected environments, environment secrets and required reviewers, but an administrator must actually enable the required reviewer and prevent self-review. No account-specific environment settings were modified by this code commit.

Before the secret-bearing CREATE step, the runner now performs read-only Git-tree comparisons between the independently approved exact PR #15 head and the executing `main` commit for **14 fixed release source, test, lockfile and evidence paths**. Missing, changed or truncated source inventories fail closed. A later change to these files does not inherit the old approval. The workflow also serializes privileged jobs using one non-cancelling concurrency group and pins checkout/setup-node actions to fixed reviewed commits.

These are proposed security controls in PR #15. They do not mean 9 GoTrue users, 38 fixture records, 140 signed UAT cases, 48 accepted production remediations or 9 signed release approvals have been completed. Independent review, protected main, the protected environment and isolated lab-only secrets remain preconditions for any manual provisioning.


### Build 91 — close AUDIT_ONLY source-review bypass (proposed; nonproduction workflow only)

The original manual runner checked protected `main`, independent approval of PR #15, and exact reviewed-source integrity only for `CREATE_NINE_AND_SEED_38`. Although `AUDIT_ONLY` does not write rows, it still executes code with the isolated tenant's Admin credential and can enumerate Auth identities. Build 91 makes the independent approval and exact-source gate **unconditional for both manual operations**, always before the secret-bearing step. No unreviewed code can use either operation to access the lab key. For a zero-credential read-only status check before merge, use the existing connected Supabase management SQL preflights instead.

This change is a proposed PR #15 workflow hardening, not configured GitHub protection, independent review, completed hosted provisioning or an accepted UAT case. Human sign-off and lab-only environment secrets remain separate prerequisites.


### Build 91 — verify the **actual** GitHub Environment reviewer rules before accessing lab secrets

An environment label alone is not a protection guarantee. Build 91's read-only GitHub check now requires the exact environment `amf-nonprod-auth-review` to have an active **required-reviewers** rule with `prevent_self_review=true`, at least one reviewer other than the workflow actor, and a deployment branch policy restricted to **protected branches**. The workflow explicitly grants the GitHub token only `actions:read`, `pull-requests:read` and `contents:read`. GitHub's environment metadata API provides these fields. A missing, unreadable or improperly configured environment halts both manual operations before the lab secrets are bound to the next step.

These are new fail-closed checks in PR #15; they do not configure the GitHub environment or prove any independent review has occurred. The repository administrator must select **Required reviewers**, **Prevent self-review**, and **Protected branches only**, and install lab-only Auth Admin and test password secrets, all after a privacy review of the currently public source repository.
