import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCrmEmailRecipientBound} from '../../src/lib/crm-email-recipient-policy.ts';

const actor='11111111-1111-4111-8111-111111111111';
const peer='22222222-2222-4222-8222-222222222222';
const good={relatedTable:'candidates',requestedAddress:'candidate@example.invalid',
 record:{email:'Candidate@Example.Invalid',assigned_recruiter:actor},
 actingUserId:actor,approvedRole:'recruiter'};

test('Build82 recruiter may use only a candidate record with matching email and ownership',()=>{
 assert.equal(isCrmEmailRecipientBound(good),true);
 assert.equal(isCrmEmailRecipientBound({...good,actingUserId:peer}),false);
 assert.equal(isCrmEmailRecipientBound({...good,record:{...good.record,assigned_recruiter:peer}}),false);
});
test('Build82 arbitrary third-party recipient is denied even to an approved administrator',()=>{
 assert.equal(isCrmEmailRecipientBound({...good,approvedRole:'admin',requestedAddress:'unrelated@example.invalid'}),false);
 assert.equal(isCrmEmailRecipientBound({...good,requestedAddress:'other@external.example'}),false);
 assert.equal(isCrmEmailRecipientBound({...good,record:{...good.record,email:null}}),false);
});
test('Build82 only administrator can email a bound client contact address',()=>{
 const client={...good,relatedTable:'clients',record:{email:'client@example.invalid'},requestedAddress:'client@example.invalid'};
 assert.equal(isCrmEmailRecipientBound({...client,approvedRole:'admin'}),true);
 assert.equal(isCrmEmailRecipientBound({...client,approvedRole:'recruiter'}),false);
});
test('Build82 role, identity and malformed email bypasses fail closed',()=>{
 assert.equal(isCrmEmailRecipientBound({...good,approvedRole:'viewer'}),false);
 assert.equal(isCrmEmailRecipientBound({...good,actingUserId:'not-a-uuid'}),false);
 assert.equal(isCrmEmailRecipientBound({...good,relatedTable:'billing'}),false);
 assert.equal(isCrmEmailRecipientBound({...good,requestedAddress:'candidate@example.invalid\nBcc:someone@example.invalid'}),false);
 assert.equal(isCrmEmailRecipientBound({...good,record:null}),false);
});
test('Build82 email endpoint invokes exact-one-role and record-bound authorization before SMTP',()=>{
 const file=readFileSync(new URL('../../src/lib/email.functions.ts',import.meta.url),'utf8');
 const handler=file.slice(file.indexOf('export const sendCrmEmail'),file.indexOf('export const listEmailHistory'));
 const gate=handler.indexOf('assertExternalEffectReleased("crm_email")');
 const role=handler.indexOf('await assertApprovedRole(context.userId, ["admin", "recruiter"])');
 const ownership=handler.indexOf('isCrmEmailRecipientBound({');
 const send=handler.indexOf('sendEmail({');
 assert(gate>=0 && role>gate && ownership>role && send>ownership);
 assert(handler.includes('memberships?.length !== 1'));
 assert(handler.includes('relatedTable: data.relatedTable'));
 assert(handler.includes('requestedAddress: data.toEmail'));
 assert(handler.includes('actingUserId: context.userId'));
 assert(!handler.includes('roles ?? []).some('));
});
