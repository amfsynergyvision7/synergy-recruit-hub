-- Batch 02: SEC-11 outbox + SEC-08 privileged function access.
-- Isolated synthetic Supabase only; no external dispatch; rollback.
begin;
insert into security_lab.sec11_outbox
(related_table,related_id,recipient,subject,body,requested_by,idempotency_key,consent_verified,suppression_verified)
values('synthetic_candidates','11111111-1111-4111-8111-111111111111',
'batch@example.invalid','Batch','Synthetic','22222222-2222-4222-8222-222222222222',
'batch-sec11-integration-20261109',true,true);
do $$declare id0 uuid; blocked boolean;begin
select id into id0 from security_lab.sec11_outbox where idempotency_key='batch-sec11-integration-20261109';
blocked:=false;
begin update security_lab.sec11_outbox set recipient='tampered@example.invalid' where id=id0;
exception when raise_exception then blocked:=true;end;
if not blocked then raise exception 'identity tamper allowed';end if;
blocked:=false;
begin delete from security_lab.sec11_outbox where id=id0;
exception when raise_exception then blocked:=true;end;
if not blocked then raise exception 'delete allowed';end if;
update security_lab.sec11_outbox set state='cancelled' where id=id0;
blocked:=false;
begin update security_lab.sec11_outbox set body='tampered' where id=id0;
exception when raise_exception then blocked:=true;end;
if not blocked then raise exception 'cancelled edit allowed';end if;
end$$;
create function security_lab.batch08_privileged_probe() returns int
language sql security definer set search_path=security_lab,pg_temp as $$select 1$$;
grant execute on function security_lab.batch08_privileged_probe() to public;
do $$begin
if not has_function_privilege('anon','security_lab.batch08_privileged_probe()','EXECUTE')
then raise exception 'baseline not exposed';end if;
end$$;
revoke execute on function security_lab.batch08_privileged_probe() from public,anon;
do $$begin
if has_function_privilege('anon','security_lab.batch08_privileged_probe()','EXECUTE')
then raise exception 'anon execute not revoked';end if;
end$$;
select 'PASS: SEC11 guard + SEC08 PUBLIC privilege batch' result;
rollback;
