# SECURITY DEFINER search-path rehearsal — verified 2026-11-10

GitHub Actions run #156: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42687985484

Tested commit `c2b51e21cf2a0412e47c37bf60ce46a860df9527`. Both jobs passed; **18 PostgreSQL PASS groups**, including:

`PASS: unqualified definer target follows unsafe search_path; qualified fixed-path writer stays trusted`

Disposable fixture `synthetic-definer-search-path.integration.sql` uses synthetic trusted/attacker schemas and compares an unqualified SECURITY DEFINER INSERT with a fixed search_path and fully qualified target. This is a demonstration of name-resolution risk, **not a live exploit test**.

Read-only production metadata previously verified `track_stage_changes()` and `set_assigned_recruiter()` are SECURITY DEFINER with no function-level `proconfig`. `track_stage_changes()` uses unqualified `candidate_stage_history`. `on_candidate_stage_change()` and `run_workflow_rules()` use fixed `search_path=public`, which still warrants review for trusted schema placement and explicit object qualification.

**Review-only remediation:** add safe function-level search_path and qualify all tables, functions, types and sequences in privileged code after checking dependencies, roles, schema CREATE permissions, and trigger compatibility. Restrict direct RPC EXECUTE appropriately, but do not assume revoking EXECUTE alone disables trigger invocation. Test original and proposed definitions against a complete isolated schema before production authorization.

No production changes or data reads. Draft branch unmerged; nine release gates blocked.
