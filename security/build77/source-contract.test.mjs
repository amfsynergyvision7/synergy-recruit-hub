import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const count = (source, expression) => [...source.matchAll(expression)].length;
const ddl = file('nonprod-public-19-source-shaped-rls-deny.sql');
const views = file('nonprod-13-security-invoker-views.sql');
const triggers = file('nonprod-32-disabled-source-triggers.sql');
const notes = file('README.md');

test('19-table source shape remains RLS-forced and deny-by-default', () => {
  assert.equal(count(ddl, /^CREATE TABLE public\./gm), 19);
  assert.equal(count(ddl, /^CREATE TYPE public\./gm), 3);
  assert.equal(count(ddl, /^ALTER TABLE public\.[^\n]+ ADD CONSTRAINT /gm), 75);
  assert.equal(count(ddl, /^ALTER TABLE public\.[^\n]+ ENABLE ROW LEVEL SECURITY;/gm), 19);
  assert.equal(count(ddl, /^ALTER TABLE public\.[^\n]+ FORCE ROW LEVEL SECURITY;/gm), 19);
  assert.equal(count(ddl, /^REVOKE ALL ON TABLE public\./gm), 19);
  assert.doesNotMatch(ddl, /^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|GRANT)\s+/gmi);
  assert.match(ddl, /EXISTS \(SELECT 1 FROM auth\.users\)/);
});

test('13 public views remain invoker-only and unreadable to anon', () => {
  assert.equal(count(views, /^CREATE VIEW public\./gm), 13);
  assert.equal(count(views, /WITH \(security_invoker=true\)/g), 13);
  assert.equal(count(views, /^REVOKE ALL ON TABLE public\./gm), 13);
  assert.doesNotMatch(views, /^\s*GRANT\s+/gmi);
});

test('all 32 source application triggers are disabled and functions are denied', () => {
  assert.equal(count(triggers, /^CREATE OR REPLACE FUNCTION public\./gm), 16);
  assert.equal(count(triggers, /^CREATE TRIGGER\b/gm), 32);
  assert.equal(count(triggers, /^ALTER TABLE public\.[^\n]+ DISABLE TRIGGER /gm), 32);
  assert.match(triggers, /REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;/);
  assert.doesNotMatch(triggers, /^CREATE TRIGGER[^\n]+\bON\s+auth\.users\b/gmi);
  assert.doesNotMatch(triggers, /^\s*GRANT\s+/gmi);
  assert.match(triggers, /t\.tgenabled <> 'D'/);
  assert.match(triggers, /has_function_privilege\('anon',oid,'EXECUTE'\)/);
});

test('evidence explicitly retains hosted and release hold boundaries', () => {
  assert.match(notes, /TECHNICAL_PRESEED_PREREQUISITES_PASS_NOT_PERMISSION_TO_PROVISION/);
  assert.match(notes, /0\/140/);
  assert.match(notes, /set_assigned_recruiter/);
  assert.match(notes, /track_stage_changes/);
  assert.match(notes, /no \x60auth\.users\x60 bootstrap hook/i);
});
