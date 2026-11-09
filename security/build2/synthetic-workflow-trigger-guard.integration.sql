-- Disposable-only integration: enforce allowlist inside a SECURITY DEFINER trigger.
-- The table/field allowlist is provisional and not a production authorization.
CREATE TABLE public.build2_rule_targets(
 id integer PRIMARY KEY,stage text NOT NULL,assigned_recruiter text NOT NULL,
 status text NOT NULL
);
CREATE TABLE public.build2_rule_config(
 id integer PRIMARY KEY,update_field_name text NOT NULL,update_field_value text NOT NULL
);
INSERT INTO public.build2_rule_targets VALUES(1,'new','recruiter-A','active');
INSERT INTO public.build2_rule_config VALUES(1,'assigned_recruiter','attacker');
CREATE FUNCTION public.build2_rules_trigger_guarded() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE rule record;
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 SELECT update_field_name,update_field_value INTO rule
 FROM public.build2_rule_config WHERE id=1;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NOT public.build2_workflow_update_allowed('candidates',rule.update_field_name)
 THEN RAISE EXCEPTION 'workflow update field not permitted';
 END IF;
 EXECUTE format('UPDATE public.build2_rule_targets SET %I = %L WHERE id = %L AND %I IS DISTINCT FROM %L',
 rule.update_field_name,rule.update_field_value,NEW.id,
 rule.update_field_name,rule.update_field_value);
 RETURN NEW;
END $fn$;
CREATE TRIGGER build2_rules_after_update AFTER UPDATE OF status
 ON public.build2_rule_targets FOR EACH ROW
 EXECUTE FUNCTION public.build2_rules_trigger_guarded();
DO $check$
BEGIN
 BEGIN
 UPDATE public.build2_rule_targets SET status='screening' WHERE id=1;
 RAISE EXCEPTION 'unauthorized workflow field was accepted';
 EXCEPTION WHEN OTHERS THEN
 IF SQLERRM<>'workflow update field not permitted' THEN RAISE; END IF;
 END;
 IF (SELECT assigned_recruiter FROM public.build2_rule_targets WHERE id=1)<>'recruiter-A'
 OR (SELECT status FROM public.build2_rule_targets WHERE id=1)<>'active'
 THEN RAISE EXCEPTION 'unauthorized rule altered target or failed to roll back'; END IF;
END $check$;
UPDATE public.build2_rule_config SET update_field_name='stage',update_field_value='submitted_to_client' WHERE id=1;
UPDATE public.build2_rule_targets SET status='screening' WHERE id=1;
DO $check$
BEGIN
 IF (SELECT stage FROM public.build2_rule_targets WHERE id=1)<>'submitted_to_client'
 OR (SELECT assigned_recruiter FROM public.build2_rule_targets WHERE id=1)<>'recruiter-A'
 THEN RAISE EXCEPTION 'allowed workflow field did not update safely'; END IF;
END $check$;
SELECT 'PASS: guarded workflow trigger rejects recruiter reassignment and applies provisional stage update' AS result;
