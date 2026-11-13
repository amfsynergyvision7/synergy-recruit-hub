/**
 * Build81 disposable-PG17-only: combine actual 19-table/38-row fixture with
 * the IDENTICAL Build80 15-policy SQL for actual PostgreSQL RLS 135-case replay.
 * Never a hosted SQL migration; never authenticates real GoTrue sessions.
 */
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
export function buildFullSourceRlsReplay(){
 const review=read('../build80/15-surface-135-read-review-only.rollback.sql');
 const b=review.indexOf('\nBEGIN;'), e=review.lastIndexOf('\nROLLBACK;');
 if(b<0||e<b||review.indexOf('\nBEGIN;',b+1)>=0||
    review.indexOf('\nROLLBACK;',e+1)>=0)
  throw new Error('Review-only RLS policy transaction boundary drift');
 const body=review.slice(b+'\nBEGIN;'.length,e);
 const frozen=JSON.parse(read('../build41/signed-http-135-read-matrix.json'));
 const cases=frozen.read_cases;
 if(!Array.isArray(cases)||cases.length!==135||frozen.identities!==9||frozen.tables!==15)
  throw new Error('Historical nine-by-fifteen read matrix changed');
 const tableOrder=cases.slice(0,15).map(c=>c.table);
 const firstBySlot=Array.from({length:9},(_,i)=>cases[i*15].sub);
 const counts=cases.map((c,i)=>{
  const slot=Math.floor(i/15)+1;
  if(c.sub!==firstBySlot[slot-1]||c.table!==tableOrder[i%15]||
     c.case_id!=='B41-SIGNED-READ-'+String(i+1).padStart(3,'0')||
     !Number.isSafeInteger(c.expected)||c.expected<0)
   throw new Error('Historical RLS matrix order/content drift');
  return '('+slot+",'"+c.table+"',"+c.expected+')';
 });
 const sql=[
 '-- Review-only Build80 policies installed ONLY inside this disposable transaction.',
 'GRANT USAGE ON SCHEMA auth TO authenticated;',
 'GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;',
 'GRANT USAGE ON TYPE public.app_role,public.user_status TO authenticated;',
 body,
 'SET LOCAL ROLE authenticated;',
 'DO $b81_rls$ DECLARE c record; observed bigint; tested int:=0; blocked int:=0; BEGIN',
 " PERFORM set_config('request.jwt.claim.sub','',true);",
 " IF (SELECT count(*) FROM public.profiles)<>0 THEN RAISE EXCEPTION 'Empty subject revealed profile'; END IF;",
 ' FOR c IN SELECT * FROM (VALUES',
 counts.join(',\n '),
 ' ) AS matrix(slot,table_name,expected_count) LOOP',
 "  PERFORM set_config('request.jwt.claim.sub',",
 "   ('0000000'||c.slot::text||'-1111-4111-8111-00000000000'||c.slot::text),true);",
 "  EXECUTE format('SELECT count(*) FROM public.%I',c.table_name) INTO observed;",
 "  IF observed<>c.expected_count THEN",
 "   RAISE EXCEPTION 'Build81 FULL SOURCE RLS historical read case % on % expected %, observed %',",
 '    tested+1,c.table_name,c.expected_count,observed;',
 '  END IF;',
 '  tested:=tested+1;',
 ' END LOOP;',
 " IF tested<>135 THEN RAISE EXCEPTION 'Expected exactly 135 full-schema RLS read cases'; END IF;",
 " FOR c IN SELECT unnest(ARRAY['app_settings','candidate_stage_history','email_log','workflow_rules']) table_name LOOP",
 '  BEGIN',
 "   EXECUTE format('SELECT count(*) FROM public.%I',c.table_name) INTO observed;",
 "   RAISE EXCEPTION 'Default-denied table exposed in full source RLS: %',c.table_name;",
 '  EXCEPTION WHEN insufficient_privilege THEN blocked:=blocked+1;',
 '  END;',
 ' END LOOP;',
 " IF blocked<>4 THEN RAISE EXCEPTION 'Expected four full-source default-denied table checks'; END IF;",
 " IF has_table_privilege(current_user,'public.candidates','INSERT,UPDATE,DELETE,TRUNCATE')",
 " OR has_table_privilege(current_user,'public.billing','INSERT,UPDATE,DELETE,TRUNCATE')",
 " OR has_table_privilege(current_user,'public.offers','INSERT,UPDATE,DELETE,TRUNCATE')",
 " OR has_table_privilege(current_user,'public.profiles','INSERT,UPDATE,DELETE,TRUNCATE')",
 " THEN RAISE EXCEPTION 'Full source unexpected app write grants'; END IF;",
 " PERFORM set_config('request.jwt.claim.sub','00000002-1111-4111-8111-000000000002',true);",
 " IF EXISTS (SELECT 1 FROM public.candidates WHERE id='00000003-1111-4111-8111-000000000003'::uuid)",
 " THEN RAISE EXCEPTION 'Recruiter row ownership violated in full source RLS'; END IF;",
 " IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE id='00000002-1111-4111-8111-000000000002'::uuid)",
 " THEN RAISE EXCEPTION 'Recruiter cannot read own synthetic candidate'; END IF;",
 " RAISE NOTICE 'BUILD81 FULL SOURCE PG17 RLS: 135/135 reads, 4/4 private denies, self ownership and no direct writes PASS';",
 'END $b81_rls$;',
 'RESET ROLE;',
 'SET LOCAL ROLE anon;',
 'DO $b81_anon$ DECLARE n integer; blocked int:=0; t text; BEGIN',
 " FOR t IN SELECT unnest(ARRAY['profiles','candidates','billing','user_roles','notifications','google_integrations']) LOOP",
 '  BEGIN',
 "   EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;",
 "   RAISE EXCEPTION 'Anonymous table read unexpectedly succeeded on %',t;",
 '  EXCEPTION WHEN insufficient_privilege THEN blocked:=blocked+1;',
 '  END;',
 ' END LOOP;',
 " IF blocked<>6 THEN RAISE EXCEPTION 'Expected six full-source anonymous denials'; END IF;",
 " RAISE NOTICE 'BUILD81 FULL SOURCE PG17: six of six anonymous reads denied';",
 'END $b81_anon$;',
 'RESET ROLE;',
 "SELECT 'BUILD81_SOURCE_SHAPED_38_ROWS_PLUS_135_ACTUAL_RLS_CASES_PASS_DISPOSABLE_ONLY' AS technical_result,",
 ' 0::integer AS genuine_signed_hosted_sessions, 0::integer AS formally_accepted_uat_cases;',
 ].join('\n');
 if((sql.match(/^CREATE POLICY b80_read_/gm)||[]).length!==15||
    counts.length!==135||!sql.includes('SET LOCAL ROLE anon;'))
  throw new Error('Unexpected compiled RLS replay shape');
 return sql;
}
