-- Build152 READ ONLY: source fingerprint of the 67 public RLS policies.
-- SELECT pg_catalog policy metadata only. No business rows; never release approval.
WITH policies AS (
 SELECT tablename,policyname,permissive,roles::text AS role_text,
        cmd,qual,with_check
 FROM pg_catalog.pg_policies
 WHERE schemaname='public'
), aggregate AS (
 SELECT count(*) AS policy_count,
        count(DISTINCT tablename) AS covered_tables,
        count(*) FILTER (
          WHERE permissive='PERMISSIVE' AND cmd='ALL'
            AND role_text='{public}' AND qual='true'
            AND with_check='true' AND policyname='Allow all for authenticated'
        ) AS broad_allow_all,
        md5(string_agg(
          tablename||E'\x1f'||policyname||E'\x1f'||permissive||
          E'\x1f'||role_text||E'\x1f'||cmd||
          E'\x1f'||coalesce(qual,'<NULL>')||
          E'\x1f'||coalesce(with_check,'<NULL>'),
          E'\n' ORDER BY tablename,policyname
        )) AS actual_policy_md5
 FROM policies
)
SELECT policy_count,covered_tables,broad_allow_all,actual_policy_md5,
       'a70190f31ed8436b2989082898a02b51' AS expected_policy_md5,
       CASE WHEN policy_count=67 AND covered_tables=18
                 AND broad_allow_all=15 AND
            actual_policy_md5='a70190f31ed8436b2989082898a02b51'
            THEN 'SOURCE_MATCH_REVIEW_ONLY_RELEASE_HOLD'
            ELSE 'SOURCE_DRIFT_RELEASE_HOLD'
       END AS policy_source_gate
FROM aggregate;
