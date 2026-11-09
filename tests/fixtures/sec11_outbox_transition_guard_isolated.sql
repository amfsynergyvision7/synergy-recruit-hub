-- SEC-11 isolated synthetic outbox guard (NOT a production migration).
-- Installed in isolated security_lab and validated with synthetic rollback tests.
-- No dispatch worker or SMTP integration is enabled.
create or replace function security_lab.sec11_guard_outbox_transition()
returns trigger language plpgsql security invoker
set search_path=security_lab,pg_temp as $$
begin
 if tg_op='DELETE' then
  raise exception 'SEC-11: outbox deletion prohibited';
 end if;
 if old.state='cancelled' then
  raise exception 'SEC-11: cancelled message immutable';
 end if;
 if new.state not in ('held','cancelled') or new.attempts<>0 then
  raise exception 'SEC-11: dispatch prohibited';
 end if;
 if new.recipient is distinct from old.recipient
 or new.idempotency_key is distinct from old.idempotency_key
 or new.requested_by is distinct from old.requested_by
 or new.related_id is distinct from old.related_id then
  raise exception 'SEC-11: identity immutable';
 end if;
 return new;
end $$;
drop trigger if exists sec11_guard_outbox_transition
on security_lab.sec11_outbox;
create trigger sec11_guard_outbox_transition
before update or delete on security_lab.sec11_outbox
for each row execute function security_lab.sec11_guard_outbox_transition();

-- Test with synthetic insert in BEGIN/ROLLBACK:
-- recipient rewrite denied; DELETE denied; held -> cancelled permitted;
-- cancelled message rewrite denied; attempts remain zero.
