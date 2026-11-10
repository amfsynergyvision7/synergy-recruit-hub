import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('../src/routes/_app.tsx', import.meta.url), 'utf8');
const middleware = readFileSync(new URL('../src/integrations/supabase/auth-middleware.ts', import.meta.url), 'utf8');

test('SEC-01 missing profiles fail closed in CRM layout', () => {
  assert.match(layout, /!profile\s*\|\|\s*profile\.status\s*!==\s*"approved"\s*\|\|\s*!profile\.is_active/);
});
test('SEC-01 notification subscription requires approved active profile', () => {
  assert.match(layout, /if\s*\(!session\s*\|\|\s*!profile\s*\|\|\s*profile\.status\s*!==\s*"approved"\s*\|\|\s*!profile\.is_active\)\s*return/);
});
test('SEC-03 server rechecks approved active profile on each request', () => {
  assert.match(middleware, /\.from\('profiles'\)/);
  assert.match(middleware, /profileError\s*\|\|\s*!profile\s*\|\|\s*profile\.status\s*!==\s*'approved'\s*\|\|\s*profile\.is_active\s*!==\s*true/);
  assert.match(middleware, /status:\s*403/);
});
test('SEC-01 server fails closed on project URL mismatch', () => {
  assert.match(middleware, /new URL\(SUPABASE_URL\)\.hostname/);
  assert.match(middleware, /host\s*!==\s*\x60\$\{expectedProject\}\.supabase\.co\x60/);
  assert.match(middleware, /Supabase project mismatch/);
});
