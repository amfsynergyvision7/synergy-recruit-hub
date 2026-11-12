-- BUILD57: REVIEW ONLY; NOT A DEPLOYABLE FINANCIAL MIGRATION.
-- Do not apply to production/staging without Finance, Legal, Security and
-- Recovery sign-off. Blocks all direct invoice DML, INCLUDING privileged
-- service_role clients, while preserving read access governed by RLS.
--
-- Build56's BEFORE stage/offer guards are still required: the existing
-- on_candidate_stage_change() catches billing errors, so a billing-only
-- block could otherwise leave stage='joined' with a swallowed failure.
-- All three guards must be approved, rehearsed and deployed atomically.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
  ON TABLE public.billing FROM PUBLIC,anon,authenticated,service_role;

-- A table-level REVOKE alone may not remove explicit COLUMN grants inherited
-- from the original catalog. Remove every column-level INSERT/UPDATE/REFERENCES
-- grant from API roles and fail the combined postflight if inheritance remains.
DO $build57_column_lock$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(format('%I',a.attname),',' ORDER BY a.attnum)
  INTO v_cols
  FROM pg_attribute a
  WHERE a.attrelid='public.billing'::regclass
    AND a.attnum>0 AND NOT a.attisdropped;
  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'Billing column catalog unavailable' USING ERRCODE='42501';
  END IF;
  EXECUTE format('REVOKE INSERT(%s),UPDATE(%s),REFERENCES(%s) ON TABLE public.billing FROM PUBLIC,anon,authenticated,service_role',
    v_cols,v_cols,v_cols);
END $build57_column_lock$;

CREATE OR REPLACE FUNCTION public.crm_block_unapproved_billing_writes()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $build57_invoice_hold$
BEGIN
  -- No user claim, environment flag, GUC or finance override may bypass this.
  -- The decision to allow actual billing requires a separately reviewed
  -- audited server workflow, not a client or role-driven switch.
  RAISE EXCEPTION 'Invoice creation, edits, deletion and truncation are on finance release HOLD'
    USING ERRCODE='42501';
  RETURN NULL;
END $build57_invoice_hold$;
REVOKE ALL ON FUNCTION public.crm_block_unapproved_billing_writes()
  FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER zz_crm_billing_write_hold
  BEFORE INSERT OR UPDATE OR DELETE ON public.billing
  FOR EACH ROW EXECUTE FUNCTION public.crm_block_unapproved_billing_writes();
CREATE TRIGGER zz_crm_billing_truncate_hold
  BEFORE TRUNCATE ON public.billing
  FOR EACH STATEMENT EXECUTE FUNCTION public.crm_block_unapproved_billing_writes();
