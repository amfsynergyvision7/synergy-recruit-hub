#!/usr/bin/env node
/**
 * Build105: reproducible, synthetic PostgreSQL 17-only test composition.
 * Inputs are versioned (not fetched from live); no Supabase calls or secrets.
 * The 19-table baseline with seven production-derived candidate trigger
 * functions is from Build44; the submission trigger snapshot is from
 * a read-only November 13 catalog inspection.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'../..');
const source=readFileSync(resolve(root,'security/build44/production-trigger-compat.integration.sql'),'utf8');
const boundary='CREATE SCHEMA crm_private;';
const cut=source.indexOf(boundary);
assert(cut>15000 && cut<source.length,'Production-derived source prefix boundary changed');
const prefix=source.slice(0,cut);
assert(prefix.startsWith('BEGIN;'));
for(const name of [
 'CREATE TABLE public.submissions (',
 'CREATE TABLE public.job_openings (',
 'CREATE TABLE public.candidates (',
 'CREATE OR REPLACE FUNCTION public.set_candidate_sync_defaults()',
 'CREATE OR REPLACE FUNCTION public.run_workflow_rules()',
 'CREATE TRIGGER trg_candidate_stage_change',
 'CREATE TRIGGER track_stage_changes_trigger',
]) assert(prefix.includes(name),'Missing source trigger/schema '+name);
assert(!prefix.includes('ROLLBACK;') && !prefix.includes('crm_commit_candidate_sync_row('));

const submission=readFileSync(resolve(root,'security/build105/production-submission-trigger.snapshot.sql'),'utf8');
const atomic=readFileSync(resolve(root,'security/build104/verified-public-application.review-only.sql'),'utf8');
for(const marker of ['normalize_submission_relationships_trigger','submissions_stage_trigger',
 'workflow_rules_trigger','public.on_submission_insert()']) assert(submission.includes(marker));
assert(!atomic.includes('CREATE OR REPLACE FUNCTION'), 'Atomic SQL must not silently replace a live routine');
const testSql=readFileSync(resolve(root,'security/build105/verified-application-source-trigger.tests.sql'),'utf8');
assert(testSql.trimEnd().endsWith('ROLLBACK;'));
// SQL is only written to the fixed disposable workflow output path.
const output='/tmp/amf-build105-source-trigger-rehearsal.sql';
const constraints=`
-- Keep the Build44 function definitions intact, but add actual production
-- uniqueness/nonnull/FKs and defaults missing from its structural snapshot.
ALTER TABLE public.job_openings ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.job_openings ALTER COLUMN job_title SET NOT NULL;
ALTER TABLE public.job_openings ADD PRIMARY KEY(id);
ALTER TABLE public.submissions ALTER COLUMN id SET DEFAULT pg_catalog.gen_random_uuid();
ALTER TABLE public.submissions ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.submissions ALTER COLUMN candidate_id SET NOT NULL;
ALTER TABLE public.submissions ADD PRIMARY KEY(id);
ALTER TABLE public.candidates ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.candidates ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE public.candidates ADD PRIMARY KEY(id);
ALTER TABLE public.submissions ADD CONSTRAINT b105_candidate_fk FOREIGN KEY(candidate_id) REFERENCES public.candidates(id);
ALTER TABLE public.submissions ADD CONSTRAINT b105_candidate_uuid_fk FOREIGN KEY(candidate_uuid) REFERENCES public.candidates(id);
ALTER TABLE public.submissions ADD CONSTRAINT b105_job_uuid_fk FOREIGN KEY(job_uuid) REFERENCES public.job_openings(id);
ALTER TABLE public.submissions ADD CONSTRAINT b105_job_id_fk FOREIGN KEY(job_id) REFERENCES public.job_openings(id);
`;
writeFileSync(output,[prefix,constraints,submission,atomic,testSql].join('\n'));
console.log('Build105 composed source-shaped candidate/submission trigger and proof tests at fixed /tmp path');
