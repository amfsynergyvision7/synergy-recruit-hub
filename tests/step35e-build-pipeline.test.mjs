import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('isolated Preview executes security tests before building application', () => {
  const script = read('scripts/vercel-build.mjs');
  const gate = script.indexOf('execSync("npm run test:security"');
  const vite = script.indexOf('execSync("npx vite build"');
  assert.ok(gate >= 0 && vite > gate, 'security suite must run before Vite build');
});

test('GitHub Actions uses the same security suite as Preview', () => {
  const workflow = read('.github/workflows/step35e-security-gates.yml');
  assert.ok(workflow.includes('branches: [security/step-35e-isolated-hardening]'));
  assert.match(workflow, /npm run test:security/);
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.scripts['test:security'].includes('step35e-build-pipeline.test.mjs'));
});
