-- Build158 READ-ONLY catalog audit: no correspondence/message rows accessed.
-- A matching index is review evidence, NEVER permission to send mail.
WITH found AS (
 SELECT i.indexrelid, i.indisunique, i.indisvalid,
        pg_get_indexdef(i.indexrelid) AS definition,
        pg_get_expr(i.indpred,i.indrelid) AS predicate
 FROM pg_catalog.pg_index i
 JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
 WHERE i.indrelid='public.email_log'::regclass
   AND idx.relname='email_log_one_unresolved_per_recipient_idx'
)
SELECT count(*) AS indexes_with_expected_name,
 count(*) FILTER (
  WHERE indisunique AND indisvalid
    AND definition LIKE '%lower(btrim(to_email))%'
    AND predicate LIKE '%pending%'
    AND predicate LIKE '%unknown%'
 ) AS matching_valid_partial_unique_indexes,
 CASE WHEN count(*) FILTER (
  WHERE indisunique AND indisvalid
    AND definition LIKE '%lower(btrim(to_email))%'
    AND predicate LIKE '%pending%' AND predicate LIKE '%unknown%'
 )=1 THEN 'REVIEW_ONLY_INDEX_PRESENT_NO_SEND_AUTHORIZATION'
 ELSE 'HOLD_UNRESOLVED_EMAIL_DUPLICATE_INDEX_ABSENT_OR_DRIFTED'
 END AS recipient_dedup_gate
FROM found;
