#!/usr/bin/env node
/**
 * Build106: compose ONLY synthetic, disposable PostgreSQL 17 setup.
 * Reuse Build105's exact source-shaped production trigger snapshot. Never
 * connect to Supabase, materialize live candidate records, or deploy SQL.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const src=readFileSync('/tmp/amf-build105-source-trigger-rehearsal.sql','utf8');
const marker='-- Build105 synthetic, disposable, source-derived trigger compatibility tests.';
const cut=src.indexOf(marker);
assert(cut>25000,'Source-shaped baseline boundary moved');
const baseline=src.slice(0,cut);
assert(baseline.startsWith('BEGIN;'),'Transactional synthetic schema required');
assert(baseline.includes('CREATE TRIGGER submissions_stage_trigger'));
assert(baseline.includes('CREATE TRIGGER workflow_rules_trigger'));
assert(baseline.includes('CREATE FUNCTION public.crm_commit_verified_public_application('));
assert(!baseline.includes('ROLLBACK;'));
const fixture=`
-- Synthetic fixtures and a deterministic overlapping candidate write.
INSERT INTO public.job_openings(id,job_title,status,open_positions)
VALUES('11111111-1111-4111-8111-111111111111','Synthetic Concurrency Role','open',1);

INSERT INTO crm_private.verified_public_applications(
 proof_id,job_id,verified_email,verified_mobile,email_verified_at,mobile_verified_at,expires_at
) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61','11111111-1111-4111-8111-111111111111','concurrent1@example.invalid','9876543161',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '10 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa62','11111111-1111-4111-8111-111111111111','sharedemail@example.invalid','9876543162',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '10 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa63','11111111-1111-4111-8111-111111111111','sharedemail@example.invalid','9876543163',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '10 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa64','11111111-1111-4111-8111-111111111111','different4@example.invalid','9876543164',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '10 minutes'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa65','11111111-1111-4111-8111-111111111111','different5@example.invalid','9876543164',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '10 minutes');

-- During concurrency runs, hold each accepted new-candidate insert for 0.5s.
-- This is a TEST-ONLY trigger; it does not exist in production.
CREATE FUNCTION public.b106_test_delay_candidate() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN
 PERFORM pg_catalog.pg_sleep(0.5);
 RETURN NEW;
END $fn$;
CREATE TRIGGER b106_test_delay_candidate BEFORE INSERT ON public.candidates
 FOR EACH ROW EXECUTE FUNCTION public.b106_test_delay_candidate();

COMMIT;
`;
const out='/tmp/amf-build106-concurrent-setup.sql';
writeFileSync(out,baseline+fixture);
console.log('Build106 synthetic source-derived trigger and proof setup composed; disposable PG database only');
