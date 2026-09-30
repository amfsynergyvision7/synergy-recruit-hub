-- ============ CONFIGURABLE WORKFLOW BUILDER (step 5 of the Zoho gap-closing plan) ============
-- Everything automated in this app so far (on_interview_change advancing candidate
-- stage, generate_reminders' four reminder kinds) is hardcoded in SQL — closing this
-- gap means an admin can define new "when X happens, do Y" rules from the UI, with
-- no migration/deploy required. This migration adds the rule table plus the one
-- generic trigger function that reads and executes those rules, attached to every
-- pipeline table.
--
-- Scope, deliberately: two action types only.
--   1. notify      — insert an in-app notification (reuses the existing
--                     notifications feed from step 1, zero new secrets).
--   2. update_field — set another field on the SAME row to a fixed value.
-- A "send an email automatically" action was considered and deliberately left out
-- of this v1: doing that safely from a database trigger means storing the Resend
-- API key at the Postgres level (a Vault secret or GUC) *in addition to* the Vercel
-- env var it already lives in for step 2's manual send — two copies of the same
-- secret to keep in sync, for a prototype-phase app, isn't worth it yet. Manual
-- emails (EmailComposeDialog) are unaffected and still work exactly as before.

CREATE TABLE public.workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- Which table this rule watches. Kept to an explicit allowlist (rather than
  -- any table name) since the trigger below is only ever attached to these six.
  table_name TEXT NOT NULL CHECK (table_name IN ('candidates','submissions','interviews','offers','billing','clients')),
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('notify','update_field')),
  -- notify fields
  notify_target TEXT CHECK (notify_target IN ('assigned_recruiter','role:admin','role:recruiter','role:operations','role:finance','role:viewer')),
  notify_title TEXT,
  notify_message TEXT,
  -- update_field fields — writes back to the *same* row/table only (no
  -- cross-table writes in v1, so a rule can't itself reach into candidates
  -- from an offers row; chain a second rule watching the candidates side
  -- instead, same as you'd chain two automations in Zoho).
  update_field_name TEXT,
  update_field_value TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;

-- Admin-only end to end: RLS here is the real gate, matching the sidebar (this
-- page lives under the Admin nav group) and the page's own role check. Nobody
-- else needs to read these — the *effect* of a rule (a notification, an updated
-- field) is visible to whoever the action targets; the rule's own definition,
-- including its message templates, is internal configuration only.
CREATE POLICY "admin manage workflow rules" ON public.workflow_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS workflow_rules_set_updated_at ON public.workflow_rules;
CREATE TRIGGER workflow_rules_set_updated_at
  BEFORE UPDATE ON public.workflow_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- The one function every governed table's trigger calls. Written entirely
-- against to_jsonb(NEW)/to_jsonb(OLD) rather than NEW.<column> so the exact
-- same function can be attached to six tables with different columns —
-- referencing a column a given table doesn't have would error at runtime if
-- written as NEW.some_column, but ->> simply returns NULL, which is exactly
-- the "this field doesn't apply here" behavior a rule needs.
CREATE OR REPLACE FUNCTION public.run_workflow_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule RECORD;
  new_val TEXT;
  old_val TEXT;
  cand_id TEXT;
  client_id TEXT;
  cand_name TEXT;
  client_name TEXT;
  recruiter_id UUID;
  target_user_id UUID;
  title TEXT;
  msg TEXT;
  notif_type TEXT;
  depth INT := COALESCE(NULLIF(current_setting('app.wf_depth', true), '')::int, 0);
BEGIN
  -- Safety valve against a misconfigured pair of rules that could otherwise
  -- retrigger each other forever (rule A: field=1 -> set field=2; rule B:
  -- field=2 -> set field=1). app.wf_depth is transaction-local (set_config's
  -- third argument below is true), so it naturally resets once this
  -- statement's transaction ends and costs nothing on the normal, non-chained
  -- path where depth never leaves 0.
  IF depth >= 5 THEN
    RETURN NEW;
  END IF;

  -- Resolve the candidate/client this row is about, once, for every rule
  -- below to reuse — both for {{full_name}}/{{company_name}} templating and
  -- for the "assigned_recruiter" notify target. Doesn't assume TG_TABLE_NAME
  -- is candidates/clients itself; falls back to the *_uuid / legacy *_id
  -- column (the same duality every other table in this app already has).
  IF TG_TABLE_NAME = 'candidates' THEN
    cand_id := NEW.id::text;
    cand_name := to_jsonb(NEW) ->> 'full_name';
    recruiter_id := (to_jsonb(NEW) ->> 'assigned_recruiter')::uuid;
  ELSE
    cand_id := COALESCE(to_jsonb(NEW) ->> 'candidate_uuid', to_jsonb(NEW) ->> 'candidate_id');
    IF cand_id IS NOT NULL THEN
      SELECT full_name, assigned_recruiter INTO cand_name, recruiter_id
        FROM public.candidates WHERE id = cand_id::uuid;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'clients' THEN
    client_id := NEW.id::text;
    client_name := to_jsonb(NEW) ->> 'company_name';
  ELSE
    client_id := COALESCE(to_jsonb(NEW) ->> 'client_uuid', to_jsonb(NEW) ->> 'client_id');
    IF client_id IS NOT NULL THEN
      SELECT company_name INTO client_name FROM public.clients WHERE id = client_id::uuid;
    END IF;
  END IF;

  FOR rule IN
    SELECT * FROM public.workflow_rules WHERE table_name = TG_TABLE_NAME AND is_active
  LOOP
    new_val := to_jsonb(NEW) ->> rule.field_name;
    old_val := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ->> rule.field_name ELSE NULL END;

    -- Fire only on a genuine transition into the watched value: an INSERT
    -- landing directly on it, or an UPDATE where it just changed to it.
    -- Skipping the case where it was already at that value is what makes
    -- action_type='update_field' safe below — see the WHERE guard there.
    IF new_val IS DISTINCT FROM rule.field_value THEN CONTINUE; END IF;
    IF TG_OP = 'UPDATE' AND old_val IS NOT DISTINCT FROM new_val THEN CONTINUE; END IF;

    title := replace(replace(COALESCE(rule.notify_title, ''), '{{full_name}}', COALESCE(cand_name, '')), '{{company_name}}', COALESCE(client_name, ''));
    msg := replace(replace(replace(COALESCE(rule.notify_message, ''), '{{full_name}}', COALESCE(cand_name, '')), '{{company_name}}', COALESCE(client_name, '')), '{{value}}', COALESCE(new_val, ''));

    -- Every notify insert below ON CONFLICT DO NOTHINGs against
    -- (related_table, related_id, type) — same idempotency pattern as
    -- step 1's generate_reminders(). Net effect: a given rule notifies a
    -- given user about a given record at most once, ever, not once per
    -- transition — so a candidate that goes rejected -> reinstated ->
    -- rejected again only notifies on the first rejection. That's the
    -- deliberately-conservative default (no repeat-notification storms from
    -- flip-flopping data); revisit if a rule genuinely needs to refire on
    -- every occurrence.
    IF rule.action_type = 'notify' THEN
      IF rule.notify_target = 'assigned_recruiter' THEN
        IF recruiter_id IS NOT NULL THEN
          notif_type := 'workflow:' || rule.id::text || ':' || recruiter_id::text;
          INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
          VALUES (recruiter_id, title, msg, notif_type, TG_TABLE_NAME, NEW.id)
          ON CONFLICT (related_table, related_id, type) DO NOTHING;
        END IF;
      ELSIF rule.notify_target LIKE 'role:%' THEN
        -- One row per matching user rather than a single broadcast row,
        -- since notifications has no role column to broadcast-by-role with
        -- — reusing the existing user_id-scoped read policy from step 1
        -- unchanged, at the cost of N rows for N users with that role
        -- (fine at this app's scale).
        FOR target_user_id IN
          SELECT ur.user_id FROM public.user_roles ur WHERE ur.role::text = substring(rule.notify_target FROM 6)
        LOOP
          notif_type := 'workflow:' || rule.id::text || ':' || target_user_id::text;
          INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
          VALUES (target_user_id, title, msg, notif_type, TG_TABLE_NAME, NEW.id)
          ON CONFLICT (related_table, related_id, type) DO NOTHING;
        END LOOP;
      END IF;

    ELSIF rule.action_type = 'update_field' THEN
      -- %I quotes identifiers (table/column names), %L quotes literal values
      -- — the standard, injection-safe way to build dynamic SQL in plpgsql.
      -- The "AND ... IS DISTINCT FROM ..." guard is what actually stops a
      -- runaway loop: it makes the UPDATE affect zero rows once the field is
      -- already at the target value, so the AFTER trigger this statement
      -- would otherwise re-fire simply doesn't run a second time for the
      -- same field. Depth-limiting above is the backstop for a rule that
      -- chains into a *different* field a second rule then chains back.
      PERFORM set_config('app.wf_depth', (depth + 1)::text, true);
      EXECUTE format(
        'UPDATE public.%I SET %I = %L WHERE id = %L AND %I IS DISTINCT FROM %L',
        TG_TABLE_NAME, rule.update_field_name, rule.update_field_value, NEW.id,
        rule.update_field_name, rule.update_field_value
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['candidates','submissions','interviews','offers','billing','clients']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS workflow_rules_trigger ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER workflow_rules_trigger AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.run_workflow_rules()',
      t
    );
  END LOOP;
END;
$$;