-- Build155 READ-ONLY: metadata-only email journal policy and schema preflight.
-- No customer correspondence rows are accessed and no writes are performed.
WITH policy AS (
 SELECT count(*) FILTER (WHERE cmd='INSERT' AND 'authenticated'=ANY(roles)) AS insert_policies,
        count(*) FILTER (WHERE cmd='UPDATE' AND 'authenticated'=ANY(roles)) AS update_policies,
        count(*) FILTER (WHERE cmd='SELECT' AND 'authenticated'=ANY(roles)) AS select_policies
 FROM pg_catalog.pg_policies
 WHERE schemaname='public' AND tablename='email_log'
), columns AS (
 SELECT count(*) AS expected_columns FROM information_schema.columns
 WHERE table_schema='public' AND table_name='email_log'
 AND column_name IN ('id','related_table','related_id','to_email','subject','body','status','error','provider_id','sent_by','created_at')
), primary_key AS (
 SELECT count(*) AS matching_primary_key
 FROM pg_catalog.pg_constraint
 WHERE conrelid='public.email_log'::regclass
   AND contype='p'
   AND pg_get_constraintdef(oid)='PRIMARY KEY (id)'
), triggers AS (
 SELECT count(*) AS custom_triggers FROM pg_catalog.pg_trigger
 WHERE tgrelid='public.email_log'::regclass AND NOT tgisinternal
)
SELECT policy.insert_policies,policy.update_policies,policy.select_policies,
       columns.expected_columns,triggers.custom_triggers,primary_key.matching_primary_key,
       CASE WHEN policy.insert_policies>0 AND policy.update_policies>0
                  AND policy.select_policies>0 AND columns.expected_columns=11
                  AND primary_key.matching_primary_key=1
            THEN 'REVIEW_REQUIRED_NO_SEND_AUTHORIZATION'
            ELSE 'HOLD_EMAIL_AUDIT_PROTOCOL_NOT_READY'
       END AS release_decision
FROM policy CROSS JOIN columns CROSS JOIN primary_key CROSS JOIN triggers;
