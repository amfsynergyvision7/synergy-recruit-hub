-- Build63 production metadata baseline. No business records; CATALOG-ONLY.
-- Intended for read-only human review, not execution of any proposed migration.
SELECT
 (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public') AS public_policy_count,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
  ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')
  AND has_table_privilege('anon',c.oid,'TRUNCATE')) AS anon_truncate_tables,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
  ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v') AS public_view_count,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
  ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'
  AND NOT coalesce(c.reloptions @> ARRAY['security_invoker=true']::text[],false))
 AS noninvoker_view_count,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
  ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p'))
 AS public_table_count;
