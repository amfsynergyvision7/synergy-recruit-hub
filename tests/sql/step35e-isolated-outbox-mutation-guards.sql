-- SEC-11 isolated synthetic outbox mutation regression, verified 2026-11-16.
-- Only run on project dhlhlasnaapzckjyvffn; never production. All writes rolled back.
-- No worker, SMTP or external communications are invoked.
begin;
do $$
declare k text := 'sec11-guard-' || substr(md5(clock_timestamp()::text),1,16); denied integer := 0;
begin
insert into security_lab.sec11_outbox (related_table,related_id,recipient,subject,body,requested_by,idempotency_key,consent_verified,suppression_verified)
values ('synthetic_candidates','11111111-1111-4111-8111-111111111111','guard@example.invalid','Synthetic','No message sent','11111111-1111-4111-8111-111111111111',k,true,true);
begin
 insert into security_lab.sec11_outbox (related_table,related_id,recipient,subject,body,requested_by,idempotency_key,consent_verified,suppression_verified)
 values ('synthetic_candidates','11111111-1111-4111-8111-111111111111','guard@example.invalid','Synthetic','No message sent','11111111-1111-4111-8111-111111111111',k||'-s',true,false);
 raise exception 'FAIL suppression bypass accepted';
exception when check_violation then denied:=denied+1; end;
begin
 update security_lab.sec11_outbox set state='sending' where idempotency_key=k;
 raise exception 'FAIL sending accepted';
exception when raise_exception then
 if SQLERRM <> 'SEC-11: dispatch prohibited' then raise; end if; denied:=denied+1; end;
begin
 update security_lab.sec11_outbox set attempts=1 where idempotency_key=k;
 raise exception 'FAIL attempts accepted';
exception when raise_exception then
 if SQLERRM <> 'SEC-11: dispatch prohibited' then raise; end if; denied:=denied+1; end;
begin
 update security_lab.sec11_outbox set consent_verified=false where idempotency_key=k;
 raise exception 'FAIL consent removal accepted';
exception when check_violation then denied:=denied+1; end;
begin
 update security_lab.sec11_outbox set recipient='changed@example.invalid' where idempotency_key=k;
 raise exception 'FAIL recipient mutation accepted';
exception when raise_exception then
 if SQLERRM <> 'SEC-11: identity immutable' then raise; end if; denied:=denied+1; end;
begin
 delete from security_lab.sec11_outbox where idempotency_key=k;
 raise exception 'FAIL deletion accepted';
exception when raise_exception then
 if SQLERRM <> 'SEC-11: outbox deletion prohibited' then raise; end if; denied:=denied+1; end;
if denied<>6 then raise exception 'FAIL expected six denials got %',denied; end if;
if (select count(*) from security_lab.sec11_outbox where idempotency_key=k and state='held' and attempts=0 and consent_verified and suppression_verified and recipient='guard@example.invalid')<>1 then raise exception 'FAIL intent changed'; end if;
end $$;
select 'PASS: six outbox mutation denials; rollback follows' as result;
rollback;
