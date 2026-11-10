-- Disposable PostgreSQL only: proposed fail-closed workflow update allowlist.
-- Not a production migration. Explicit table+field pairs are provisional and
-- must be reviewed against legitimate CRM workflow requirements.
CREATE FUNCTION public.build2_workflow_update_allowed(target_table text,target_field text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
 SELECT (target_table,target_field) IN (
   ('candidates','stage'),
   ('submissions','status'),
   ('interviews','status'),
   ('offers','offer_status')
 );
$fn$;
DO $check$
DECLARE t text; f text;
BEGIN
 FOR t,f IN SELECT * FROM (VALUES
 ('candidates','assigned_recruiter'),
 ('candidates','created_by'),
 ('profiles','status'),
 ('profiles','is_active'),
 ('user_roles','role'),
 ('workflow_rules','update_field_name'),
 ('billing','payment_status'),
 ('candidates','id'),
 ('candidates','email'),
 ('clients','created_by'),
 ('candidates','stage; DROP TABLE candidates; --'),
 ('not_real','status'),
 (NULL::text,'status'),
 ('candidates',NULL::text)
 ) AS forbidden(t,f)
 LOOP
  IF coalesce(public.build2_workflow_update_allowed(t,f),false)
  THEN RAISE EXCEPTION 'workflow allowlist accepted forbidden %.%',t,f; END IF;
 END LOOP;
 IF NOT public.build2_workflow_update_allowed('candidates','stage')
 OR NOT public.build2_workflow_update_allowed('submissions','status')
 OR NOT public.build2_workflow_update_allowed('interviews','status')
 OR NOT public.build2_workflow_update_allowed('offers','offer_status')
 THEN RAISE EXCEPTION 'workflow allowlist rejected expected provisional fields'; END IF;
END $check$;
SELECT 'PASS: proposed workflow field allowlist rejects authorization, ownership, unknown and malformed targets' AS result;
