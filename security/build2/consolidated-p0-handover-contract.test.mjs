import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const handover = readFileSync(new URL('consolidated-p0-release-handover-20261110.md', import.meta.url), 'utf8');
const evidence = JSON.parse(readFileSync(new URL('release-evidence.json', import.meta.url), 'utf8'));
test('handover keeps execution and production release explicitly blocked', () => {
 for (const marker of ['NOT AUTHORISED TO EXECUTE', 'synthetic', 'rollback', 'No merge/deploy', 'No outbound side effects']) {
  assert.ok(handover.toLowerCase().includes(marker.toLowerCase()), marker);
 }
 assert.equal(Object.keys(evidence).length, 9);
 for (const [key, value] of Object.entries(evidence)) assert.deepEqual(value, { passed: false, evidence: '' }, key);
});
test('handover covers the five required identities and critical management decisions', () => {
 for (const marker of ['Admin', 'Active assigned recruiter', 'Active other recruiter', 'Inactive account', 'Unauthenticated', 'offers.joining_status', 'billing.payment_status', 'clients.status', 'Placement fee and GST', 'Final release approval']) {
  assert.ok(handover.includes(marker), marker);
 }
});
