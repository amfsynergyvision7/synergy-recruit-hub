-- Build57: synthetic joined-source risk fixture test. The two historical
-- synthetic invoice rows must remain unchanged. Everything ROLLS BACK.
DO $build57_acl_and_owner$
DECLARE
  v_initial integer;
  v_final integer;
  v_role name;
  v_action text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='billing'
     AND policyname='billing_admin_write'
     AND qual='false' AND with_check='false') THEN
     RAISE EXCEPTION 'Permissive invoice write RLS policy was not denied';
  END IF;
  IF NOT (SELECT r.rolbypassrls FROM pg_roles r WHERE r.rolname='service_role') THEN
    RAISE EXCEPTION 'Synthetic service role must reproduce BYPASSRLS';
  END IF;
  SELECT count(*) INTO v_initial FROM public.billing;
  IF v_initial<>2 THEN
    RAISE EXCEPTION 'Expected exactly two existing synthetic source-risk invoices, found %',v_initial;
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role']::name[]
  LOOP
    FOREACH v_action IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']::text[]
    LOOP
      IF has_table_privilege(v_role,'public.billing',v_action) THEN
        RAISE EXCEPTION 'Invoice % privilege remains for %',v_action,v_role;
      END IF;
    END LOOP;
    FOREACH v_action IN ARRAY ARRAY['INSERT','UPDATE','REFERENCES']::text[]
    LOOP
      IF has_any_column_privilege(v_role,'public.billing',v_action) THEN
        RAISE EXCEPTION 'Invoice column % privilege remains for %',v_action,v_role;
      END IF;
    END LOOP;
    IF NOT has_table_privilege(v_role,'public.billing','SELECT') THEN
      RAISE EXCEPTION 'Existing invoice read permission unexpectedly revoked from %',v_role;
    END IF;
  END LOOP;
  IF has_function_privilege('anon','public.crm_block_unapproved_billing_writes()','EXECUTE')
   OR has_function_privilege('authenticated','public.crm_block_unapproved_billing_writes()','EXECUTE')
   OR has_function_privilege('service_role','public.crm_block_unapproved_billing_writes()','EXECUTE') THEN
    RAISE EXCEPTION 'Billing hold trigger function callable as API role';
  END IF;
  IF (SELECT count(*) FROM pg_trigger t
      WHERE t.tgrelid='public.billing'::regclass
        AND t.tgname IN ('zz_crm_billing_write_hold','zz_crm_billing_truncate_hold')
        AND t.tgenabled='O' AND NOT t.tgisinternal)<>2 THEN
    RAISE EXCEPTION 'Invoice DML/truncate trigger hold missing or inactive'; END IF;

  BEGIN
    INSERT INTO public.billing(id,candidate_uuid,payment_status)
    VALUES('77777777-7777-4777-8777-777777777771',
      '11111111-1111-4111-8111-111111111111','unpaid');
    RAISE EXCEPTION 'Invoice INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    UPDATE public.billing SET payment_status='paid';
    RAISE EXCEPTION 'Invoice UPDATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    DELETE FROM public.billing;
    RAISE EXCEPTION 'Invoice DELETE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    TRUNCATE TABLE public.billing;
    RAISE EXCEPTION 'Invoice TRUNCATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  SELECT count(*) INTO v_final FROM public.billing;
  IF v_final<>v_initial THEN
    RAISE EXCEPTION 'Billing changed after 4 rejected operations: before %, after %',v_initial,v_final;
  END IF;
END $build57_acl_and_owner$;

-- Actual API role denial, independent of the owner-level trigger veto.
SET ROLE authenticated;
DO $build57_authenticated$
BEGIN
  BEGIN
    UPDATE public.billing SET payment_status='paid';
    RAISE EXCEPTION 'Authenticated bypassed billing ACL';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $build57_authenticated$;
RESET ROLE;
SET ROLE service_role;
DO $build57_service$
BEGIN
  BEGIN
    INSERT INTO public.billing(id,payment_status)
    VALUES('77777777-7777-4777-8777-777777777772','unpaid');
    RAISE EXCEPTION 'Service role bypassed billing ACL';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $build57_service$;
RESET ROLE;
SET ROLE anon;
DO $build57_anon$
BEGIN
  BEGIN
    DELETE FROM public.billing;
    RAISE EXCEPTION 'Anonymous bypassed billing ACL';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $build57_anon$;
RESET ROLE;
