-- Synthetic-only verification. NEVER run against production.
-- Run only in Supabase project dhlhlasnaapzckjyvffn.
-- Transaction and local role/claims ensure no persistent changes.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $check$
DECLARE
  visible_other_profiles integer;
  visible_own_probe integer;
  visible_candidates integer;
  visible_jobs integer;
BEGIN
  SELECT count(*) INTO visible_other_profiles FROM security_lab.sec04_profiles;
  SELECT count(*) INTO visible_own_probe FROM security_lab.sec02_rls_probe;
  SELECT count(*) INTO visible_candidates FROM security_lab.synthetic_candidates;
  SELECT count(*) INTO visible_jobs FROM security_lab.synthetic_jobs;
  IF visible_other_profiles <> 0 OR visible_own_probe <> 1
    OR visible_candidates <> 0 OR visible_jobs <> 0 THEN
    RAISE EXCEPTION 'SEC-02 RLS verification failed: profiles %, own probe %, candidates %, jobs %',
      visible_other_profiles, visible_own_probe, visible_candidates, visible_jobs;
  END IF;
  IF has_column_privilege('authenticated','security_lab.sec04_profiles','status','UPDATE')
    OR has_column_privilege('authenticated','security_lab.sec04_profiles','is_active','UPDATE')
    OR NOT has_column_privilege('authenticated','security_lab.sec04_profiles','full_name','UPDATE') THEN
    RAISE EXCEPTION 'SEC-04 profile privilege verification failed';
  END IF;
END
$check$;
ROLLBACK;
