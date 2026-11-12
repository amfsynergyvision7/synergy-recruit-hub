-- Build56 FULL-POLICY: test financial joined holds in source-composed
-- 67-policy->35-policy security release fixture, under synthetic superuser DML.
-- No legacy billing function attached in Build49 fixture; independent
-- Build56 live-source replay covers both actual legacy handlers.
RESET ROLE;
DO $b56_full_finance$
DECLARE
 n bigint;
 before_billing bigint;
BEGIN
 SELECT count(*) INTO before_billing FROM public.billing;
 IF (SELECT count(*) FROM pg_trigger t
    WHERE t.tgname IN ('zz_crm_hold_joined_candidate','zz_crm_hold_joined_offer')
    AND t.tgenabled='O' AND NOT t.tgisinternal)<>2 THEN
   RAISE EXCEPTION 'Joined-stage and offer guards missing'; END IF;
 BEGIN
  UPDATE public.candidates SET stage='joined'
    WHERE id='11111111-1111-4111-8111-111111111111';
  RAISE EXCEPTION 'Candidate joined transition bypassed financial hold';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT count(*) INTO n FROM public.candidates
  WHERE id='11111111-1111-4111-8111-111111111111' AND stage='joined';
 IF n<>0 THEN RAISE EXCEPTION 'Candidate stage changed after failed joined transition'; END IF;
 INSERT INTO public.offers(id,candidate_uuid,candidate_id,offer_status,joining_status)
 VALUES('66666666-6666-4666-8666-666666666661',
 '11111111-1111-4111-8111-111111111111',
 '11111111-1111-4111-8111-111111111111','pending','pending');
 BEGIN
  UPDATE public.offers SET joining_status='joined'
  WHERE id='66666666-6666-4666-8666-666666666661';
  RAISE EXCEPTION 'Joined offer bypassed financial hold';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.offers WHERE id='66666666-6666-4666-8666-666666666661'
  AND joining_status='joined') THEN
   RAISE EXCEPTION 'Offer stage changed after rejected financial transition'; END IF;
 BEGIN
  INSERT INTO public.offers(id,candidate_uuid,joining_status)
  VALUES('66666666-6666-4666-8666-666666666662',
    '11111111-1111-4111-8111-111111111111','joined');
  RAISE EXCEPTION 'Joined offer insert bypassed financial hold';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.candidates(id,full_name,stage)
  VALUES('66666666-6666-4666-8666-666666666663','Blocked Joined Candidate','joined');
  RAISE EXCEPTION 'Joined candidate insert bypassed financial hold';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT count(*) INTO n FROM public.billing;
 IF n<>before_billing THEN RAISE EXCEPTION 'Financial hold created billing rows: before %, after %',before_billing,n; END IF;
END $b56_full_finance$;
