-- Run against recovered disposable PostgreSQL only.
DO $b60_recovered$
DECLARE c integer; n integer; v oid;
BEGIN
 SELECT count(*) INTO c FROM public.candidates;
 IF c<>2 THEN RAISE EXCEPTION 'Recovery candidate count % !=2',c; END IF;
 SELECT count(*) INTO c FROM public.billing;
 IF c<>1 THEN RAISE EXCEPTION 'Recovery invoice count % !=1',c; END IF;
 SELECT count(*) INTO c FROM public.audit_logs;
 IF c<>1 THEN RAISE EXCEPTION 'Recovery audit count % !=1',c; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE
  schemaname='public' AND tablename='candidates' AND
  policyname='candidate_own_read') THEN
  RAISE EXCEPTION 'Recovery lost candidate RLS policy'; END IF;
 v='public.vw_candidate_filters'::regclass;
 IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=v AND
  'security_invoker=true'=ANY(c.reloptions)) THEN
  RAISE EXCEPTION 'Recovery view reverted to definer mode'; END IF;
 IF has_table_privilege('anon','public.candidates','SELECT')
 OR has_table_privilege('anon',v,'SELECT')
 OR has_table_privilege('authenticated','public.billing','INSERT')
 OR has_table_privilege('service_role','public.billing','UPDATE') THEN
  RAISE EXCEPTION 'Recovery restored prohibited grants'; END IF;
 IF NOT has_table_privilege('authenticated',v,'SELECT') THEN
  RAISE EXCEPTION 'Recovery lost signed-in view read'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t WHERE
  t.tgrelid='public.billing'::regclass AND
  t.tgname IN ('zz_b60_invoice_row_hold','zz_b60_invoice_truncate_hold')
  AND t.tgenabled='O';
 IF n<>2 THEN RAISE EXCEPTION 'Recovery lost enabled invoice HOLD triggers'; END IF;
 IF has_function_privilege('anon','public.crm_recovery_invoice_hold()','EXECUTE') THEN
  RAISE EXCEPTION 'Recovery made privileged trigger web-callable'; END IF;

 -- Database owner also must fail while the financial freeze is active.
 BEGIN
  INSERT INTO public.billing VALUES(
  '55555555-5555-4555-8555-555555555555','SHOULD-NOT-EXIST',1,'unpaid');
  RAISE EXCEPTION 'Recovery owner bypassed invoice trigger';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  TRUNCATE TABLE public.billing;
  RAISE EXCEPTION 'Recovery owner bypassed truncate trigger';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.billing)<>1 THEN
  RAISE EXCEPTION 'Recovery test altered invoice rows'; END IF;
END $b60_recovered$;
SET ROLE authenticated;
DO $b60_signed_scope$
DECLARE n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 SELECT count(*) INTO n FROM public.vw_candidate_filters;
 IF n<>1 THEN RAISE EXCEPTION 'Recovered role A sees % candidates, expected 1',n; END IF;
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',true);
 SELECT count(*) INTO n FROM public.vw_candidate_filters;
 IF n<>1 THEN RAISE EXCEPTION 'Recovered role B sees % candidates, expected 1',n; END IF;
END $b60_signed_scope$;
RESET ROLE;
SET ROLE anon;
DO $b60_anon$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.vw_candidate_filters;
  RAISE EXCEPTION 'Recovery exposed view to anonymous';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $b60_anon$;
RESET ROLE;
SELECT 'PASS B60 synthetic restored rows, audit, RLS, owner-invoker views, ACL, invoice trigger veto, 2 recruiter roles and anon denial' AS outcome;
