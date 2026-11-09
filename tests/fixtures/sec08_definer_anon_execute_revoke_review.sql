-- SEC-08 REVIEW ONLY. Production BEGIN/ROLLBACK compile tested 2026-11-09.
-- 16 public SECURITY DEFINER functions were executable by anon.
-- REVOKE FROM anon alone left 9 exposed due to inherited PUBLIC grants.
-- REVOKE FROM PUBLIC,anon yielded zero anonymous-executable definers.
-- CAUTION: Do not deploy until authorized caller matrix, triggers, and
-- unauthenticated onboarding flows have been tested. This changes RPC grants.
begin;
do $$
declare f record;
begin
 for f in
  select p.oid::regprocedure as signature
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
 loop
  execute format('revoke execute on function %s from public, anon',f.signature);
 end loop;
end $$;
do $$
declare n integer;
begin
 select count(*) into n from pg_proc p
 join pg_namespace ns on ns.oid=p.pronamespace
 where ns.nspname='public' and p.prosecdef
 and has_function_privilege('anon',p.oid,'EXECUTE');
 if n<>0 then raise exception 'SEC-08: % privileged functions still callable by anon',n; end if;
end $$;
rollback;
