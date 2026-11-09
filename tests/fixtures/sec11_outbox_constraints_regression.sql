-- Isolated security_lab ONLY. No SMTP, no worker, no production data.
-- Run inside transaction; test must reject duplicates, missing consent,
-- and non-example.invalid recipients. All data is rolled back.
begin;
insert into security_lab.sec11_outbox
(related_table,related_id,recipient,subject,body,requested_by,idempotency_key,consent_verified,suppression_verified)
values ('synthetic_candidates','11111111-1111-4111-8111-111111111111',
'test@example.invalid','Synthetic test','No email sent',
'11111111-1111-4111-8111-111111111111','sec11-test-key-20261109',true,true);
do $$ begin
 begin
  insert into security_lab.sec11_outbox
  (related_table,related_id,recipient,subject,body,requested_by,idempotency_key,consent_verified,suppression_verified)
  values ('synthetic_candidates','11111111-1111-4111-8111-111111111111',
  'test@example.invalid','Synthetic test','No email sent',
  '11111111-1111-4111-8111-111111111111','sec11-test-key-20261109',true,true);
  raise exception 'FAIL duplicate key accepted';
 exception when unique_violation then null; end;
 begin
  insert into security_lab.sec11_outbox
  (related_table,related_id,recipient,subject,body,requested_by,idempotency_key,consent_verified,suppression_verified)
  values ('synthetic_candidates','11111111-1111-4111-8111-111111111111',
  'test@example.invalid','Synthetic test','No email sent',
  '11111111-1111-4111-8111-111111111111','sec11-no-consent-20261109',false,true);
  raise exception 'FAIL unchecked consent accepted';
 exception when check_violation then null; end;
 begin
  insert into security_lab.sec11_outbox
  (related_table,related_id,recipient,subject,body,requested_by,idempotency_key,consent_verified,suppression_verified)
  values ('synthetic_candidates','11111111-1111-4111-8111-111111111111',
  'real@example.com','Synthetic test','No email sent',
  '11111111-1111-4111-8111-111111111111','sec11-real-address-20261109',true,true);
  raise exception 'FAIL external recipient accepted';
 exception when check_violation then null; end;
end $$;
select count(*) as synthetic_held_count,max(attempts) as max_attempts
from security_lab.sec11_outbox where idempotency_key='sec11-test-key-20261109';
rollback;
