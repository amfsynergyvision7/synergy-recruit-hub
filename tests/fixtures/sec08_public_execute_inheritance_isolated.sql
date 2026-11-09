-- SEC-08 synthetic regression: inherited PUBLIC EXECUTE must be removed.
-- Run only in isolated Supabase security_lab; all changes rolled back.
begin;
create or replace function security_lab.sec08_privileged_probe()
returns integer language sql security definer
set search_path=security_lab,pg_temp as $$select 1$$;
grant usage on schema security_lab to anon;
grant execute on function security_lab.sec08_privileged_probe() to public;
do $$begin
 if not has_function_privilege('anon','security_lab.sec08_privileged_probe()','EXECUTE')
 then raise exception 'baseline missing'; end if;
end$$;
revoke execute on function security_lab.sec08_privileged_probe() from anon;
do $$begin
 if not has_function_privilege('anon','security_lab.sec08_privileged_probe()','EXECUTE')
 then raise exception 'PUBLIC inheritance not reproduced'; end if;
end$$;
revoke execute on function security_lab.sec08_privileged_probe() from public,anon;
do $$begin
 if has_function_privilege('anon','security_lab.sec08_privileged_probe()','EXECUTE')
 then raise exception 'anonymous execute still allowed'; end if;
end$$;
select 'PASS: inherited PUBLIC EXECUTE removed' as result;
rollback;
