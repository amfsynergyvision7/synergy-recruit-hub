-- Stable synthetic logical contents digest: works before and after restore.
SELECT md5(
 (SELECT string_agg(id::text||':'||assigned_recruiter::text||':'||stage, '|'
   ORDER BY id) FROM public.candidates)||'#'||
 (SELECT string_agg(id::text||':'||invoice_number||':'||amount::text||':'||payment_status,'|'
   ORDER BY id) FROM public.billing)||'#'||
 (SELECT string_agg(id::text||':'||action||':'||record_id::text,'|'
   ORDER BY id) FROM public.audit_logs)
) AS logical_snapshot_digest;
