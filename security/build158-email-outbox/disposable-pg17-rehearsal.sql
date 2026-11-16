-- Build158 disposable PostgreSQL 17 ONLY.
-- Enforced exact database-name gate. All synthetic data rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'amf_build158_email_lab' THEN
  RAISE EXCEPTION 'BUILD158 STOP: wrong database; no review SQL execution permitted';
 END IF;
END
$guard$;
CREATE TABLE public.email_log (
 id uuid PRIMARY KEY,
 related_table text NOT NULL,
 related_id uuid NOT NULL,
 to_email text NOT NULL,
 status text NOT NULL,
 sent_by uuid NOT NULL
);
-- Executing exactly the review SQL after the disposable DB guard;
-- production roles/secrets and real business rows are not available.
\ir pending-uniqueness.DO-NOT-APPLY.sql.txt
INSERT INTO public.email_log
 (id,related_table,related_id,to_email,status,sent_by)
VALUES
 ('11111111-1111-4111-8111-111111111111',
  'candidates','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Example@INVALID.test','pending',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
DO $tests$
DECLARE rejected boolean;
BEGIN
 -- Another actor and another attempt UUID cannot reserve the same unresolved
 -- record and normalized mailbox, even using different email case/spaces.
 rejected:=false;
 BEGIN
  INSERT INTO public.email_log
  VALUES ('22222222-2222-4222-8222-222222222222',
   'candidates','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   ' example@invalid.TEST  ','pending',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN
   RAISE EXCEPTION 'BUILD158 FAIL: same-record pending duplicate accepted';
 END IF;
 -- Distinct record remains independent, even with same mailbox.
 INSERT INTO public.email_log
 VALUES ('33333333-3333-4333-8333-333333333333',
   'candidates','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'example@invalid.test','pending',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 -- Distinct mailbox on same record remains independent.
 INSERT INTO public.email_log
 VALUES ('44444444-4444-4444-8444-444444444444',
   'candidates','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'other@invalid.test','pending',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 -- A fully settled SENT row no longer blocks a later new message.
 UPDATE public.email_log SET status='sent'
 WHERE id='11111111-1111-4111-8111-111111111111' AND status='pending';
 INSERT INTO public.email_log
 VALUES ('22222222-2222-4222-8222-222222222222',
   'candidates','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'example@invalid.test','pending',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 -- A provider-unknown state MUST retain the recipient lock.
 UPDATE public.email_log SET status='unknown'
 WHERE id='22222222-2222-4222-8222-222222222222' AND status='pending';
 rejected:=false;
 BEGIN
  INSERT INTO public.email_log
  VALUES ('55555555-5555-4555-8555-555555555555',
   'candidates','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'example@invalid.test','pending',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN
   RAISE EXCEPTION 'BUILD158 FAIL: unknown status did not block duplicate';
 END IF;
 -- Email recipient scope is also tied to the related table.
 INSERT INTO public.email_log
 VALUES ('66666666-6666-4666-8666-666666666666',
  'clients','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'example@invalid.test','pending',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 IF (SELECT count(*) FROM public.email_log) <> 5 THEN
   RAISE EXCEPTION 'BUILD158 FAIL: unexpected synthetic row count';
 END IF;
END
$tests$;
-- Assert the index is unique/valid and covers just the unresolved states.
DO $verify$
BEGIN
 IF NOT EXISTS (
   SELECT 1
   FROM pg_catalog.pg_index i
   JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid
   WHERE i.indrelid='public.email_log'::regclass
     AND c.relname='email_log_one_unresolved_per_recipient_idx'
     AND i.indisunique AND i.indisvalid
     AND pg_get_expr(i.indpred,i.indrelid) LIKE '%pending%'
     AND pg_get_expr(i.indpred,i.indrelid) LIKE '%unknown%'
 ) THEN
   RAISE EXCEPTION 'BUILD158 FAIL: scoped unique index missing or invalid';
 END IF;
END
$verify$;
ROLLBACK;
