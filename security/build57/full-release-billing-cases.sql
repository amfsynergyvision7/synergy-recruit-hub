-- Build57 full 67->35 policy and account/candidate release rehearsal.
-- This executes after the complete pinned migration, not in production.
RESET ROLE;
DO $build57_full_billing$
DECLARE
 v_previous bigint;
 v_after bigint;
 v_role name;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='billing'
      AND policyname='billing_admin_write'
      AND qual='false' AND with_check='false') THEN
     RAISE EXCEPTION 'Full-policy invoice write RLS was not fail-closed';
 END IF;
 SELECT count(*) INTO v_previous FROM public.billing;
 IF (SELECT count(*) FROM pg_trigger
    WHERE tgrelid='public.billing'::regclass
     AND tgname IN ('zz_crm_billing_write_hold','zz_crm_billing_truncate_hold')
     AND tgenabled='O')<>2
 THEN RAISE EXCEPTION 'Missing invoice write and truncate guards'; END IF;
 FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role']::name[]
 LOOP
  IF has_table_privilege(v_role,'public.billing','INSERT')
   OR has_table_privilege(v_role,'public.billing','UPDATE')
   OR has_table_privilege(v_role,'public.billing','DELETE')
   OR has_table_privilege(v_role,'public.billing','TRUNCATE')
   OR has_any_column_privilege(v_role,'public.billing','INSERT')
   OR has_any_column_privilege(v_role,'public.billing','UPDATE') THEN
   RAISE EXCEPTION 'Financial API write grant survives for %',v_role;
  END IF;
 END LOOP;
 BEGIN
  INSERT INTO public.billing(id,payment_status)
  VALUES('77777777-7777-4777-8777-777777777773','unpaid');
  RAISE EXCEPTION 'Owner invoice INSERT bypassed full source lockdown';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.billing SET payment_status='paid';
  RAISE EXCEPTION 'Owner invoice UPDATE bypassed full source lockdown';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM public.billing;
  RAISE EXCEPTION 'Owner invoice DELETE bypassed full source lockdown';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  TRUNCATE public.billing;
  RAISE EXCEPTION 'Owner invoice TRUNCATE bypassed full source lockdown';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT count(*) INTO v_after FROM public.billing;
 IF v_after<>v_previous THEN
  RAISE EXCEPTION 'Full release rehearsal changed billing row count % -> %',
   v_previous,v_after;
 END IF;
END $build57_full_billing$;
SET ROLE authenticated;
DO $build57_full_auth$
BEGIN
 BEGIN
  INSERT INTO public.billing(id,payment_status)
  VALUES('77777777-7777-4777-8777-777777777774','unpaid');
  RAISE EXCEPTION 'Authenticated invoice INSERT bypassed ACL';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $build57_full_auth$;
RESET ROLE;
