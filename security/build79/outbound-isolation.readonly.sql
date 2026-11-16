-- Build79 live NONPRODUCTION-only READ-ONLY external-side-effect isolation inventory.
-- Confirm app table publications/storage/pg_net/cron/outbound SQL keyword surfaces
-- before any invented fixture is ever provisioned. Separate Edge Function listing needed.
SELECT
 (SELECT count(*) FROM pg_publication WHERE puballtables) AS publish_all_publications,
 (SELECT count(*) FROM pg_publication_rel pr JOIN pg_class c ON c.oid=pr.prrelid
  WHERE c.relnamespace='public'::regnamespace) AS published_app_tables,
 (SELECT count(*) FROM storage.buckets) AS storage_buckets,
 (SELECT count(*) FROM storage.objects) AS storage_objects,
 (SELECT count(*) FROM pg_extension
  WHERE extname IN ('pg_net','pg_cron','http','pgmq')) AS outbound_extensions,
 (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
  AND pg_get_functiondef(p.oid) ~* 'net\\.http|http_post|http_get|smtp|edge_functions|send_email')
    AS application_functions_with_obvious_outbound_keywords,
 (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'D')
    AS enabled_application_triggers,
 CASE WHEN
  (SELECT count(*) FROM pg_publication WHERE puballtables)=0 AND
  (SELECT count(*) FROM pg_publication_rel pr JOIN pg_class c ON c.oid=pr.prrelid
   WHERE c.relnamespace='public'::regnamespace)=0 AND
  (SELECT count(*) FROM storage.buckets)=0 AND
  (SELECT count(*) FROM storage.objects)=0 AND
  (SELECT count(*) FROM pg_extension
   WHERE extname IN ('pg_net','pg_cron','http','pgmq'))=0 AND
  (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'D')=0
 THEN 'BUILD79_PREAUTH_OUTBOUND_CATALOG_PASS_EDGE_LIST_SEPARATE'
 ELSE 'HOLD_BUILD79_OUTBOUND_CATALOG_REVIEW_REQUIRED'
 END AS isolation_gate;
