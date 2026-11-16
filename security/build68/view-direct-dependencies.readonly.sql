-- Build68 direct dependencies for 13 live public views. READ ONLY.
-- No candidate, client or financial rows are retrieved, no schema writes.
SELECT v.relname AS view_name, ref.relname AS source_object,
 CASE ref.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'table'
  WHEN 'v' THEN 'view' ELSE ref.relkind::text END AS source_kind
FROM pg_catalog.pg_class v
JOIN pg_catalog.pg_namespace nv ON nv.oid=v.relnamespace
JOIN pg_catalog.pg_rewrite rw ON rw.ev_class=v.oid
JOIN pg_catalog.pg_depend d ON d.objid=rw.oid
  AND d.classid='pg_catalog.pg_rewrite'::regclass
JOIN pg_catalog.pg_class ref ON ref.oid=d.refobjid
JOIN pg_catalog.pg_namespace nr ON nr.oid=ref.relnamespace
WHERE nv.nspname='public' AND v.relkind='v' AND nr.nspname='public'
 AND ref.oid<>v.oid
GROUP BY v.relname,ref.relname,ref.relkind
ORDER BY v.relname,source_kind,source_object;
