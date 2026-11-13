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
