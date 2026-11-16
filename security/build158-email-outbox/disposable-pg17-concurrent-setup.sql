-- Build158 concurrent PostgreSQL 17 fixture setup ONLY.
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'amf_build158_email_lab' THEN
  RAISE EXCEPTION 'BUILD158 CONCURRENCY STOP: wrong database';
 END IF;
END
$guard$;
CREATE TABLE public.email_log (
 id uuid PRIMARY KEY, related_table text NOT NULL, related_id uuid NOT NULL,
 to_email text NOT NULL, status text NOT NULL, sent_by uuid NOT NULL
);
\ir pending-uniqueness.DO-NOT-APPLY.sql.txt
COMMIT;
