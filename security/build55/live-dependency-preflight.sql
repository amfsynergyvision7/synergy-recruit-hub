-- BUILD55 LIVE CATALOG READ-ONLY PRE-FLIGHT.
-- SELECT ONLY: safe for production read-only verification. No DDL or DML.
-- Source baseline from 2026-11-12 live catalog, not from test fixtures.
-- REFUSE release on ANY dependency drift; user acceptance still mandatory.
WITH foreign_keys AS (
 SELECT n.nspname||'.'||c.relname AS source_table,
        con.conname,pg_get_constraintdef(con.oid,true) AS definition
 FROM pg_constraint con
 JOIN pg_class c ON c.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE con.contype='f' AND
   (con.confrelid='public.candidates'::regclass
     OR con.conrelid='public.candidates'::regclass)
), triggers AS (
 SELECT t.tgname,pg_get_triggerdef(t.oid,true) AS definition
 FROM pg_trigger t
 WHERE t.tgrelid='public.candidates'::regclass AND NOT t.tgisinternal
), live AS (
 SELECT
  (SELECT count(*) FROM foreign_keys) AS fk_count,
  (SELECT md5(string_agg(source_table||E'\x1f'||conname||E'\x1f'||definition,
            E'\n' ORDER BY source_table,conname)) FROM foreign_keys) AS fk_digest,
  (SELECT count(*) FROM triggers) AS candidate_trigger_count,
  (SELECT md5(string_agg(tgname||E'\x1f'||definition,E'\n' ORDER BY tgname))
   FROM triggers) AS candidate_trigger_digest
)
SELECT fk_count,fk_digest,candidate_trigger_count,candidate_trigger_digest,
 CASE WHEN fk_count=11
       AND fk_digest='84fe09e127229b017c85b05d9a49da21'
       AND candidate_trigger_count=7
       AND candidate_trigger_digest='b0d55f339dc38c0a2efd61dfe82f0b6a'
      THEN 'MATCH_READ_ONLY_NOT_RELEASE_AUTHORIZATION'
      ELSE 'DRIFT_BLOCK_RELEASE' END AS release_preflight
FROM live;
