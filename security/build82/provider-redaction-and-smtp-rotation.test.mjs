import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const smtp=read('src/lib/email.server.ts');
const sheets=read('src/lib/sheets-sync.server.ts');

test('SMTP release gate precedes access to protected credentials or delivery',()=>{
 const hold=smtp.indexOf('if (isExternalEffectPaused("crm_email"))');
 const secret=smtp.indexOf('const user = process.env.SMTP_USER');
 const sent=smtp.indexOf('.sendMail(');
 assert(hold>0&&hold<secret&&secret<sent);
 assert(smtp.includes('CRM email delivery is paused pending release approval'));
});
test('SMTP transport invalidates warm connection on secret rotation without caching raw password',()=>{
 assert(smtp.includes('createHash("sha256").update(pass, "utf8").digest("hex")'));
 assert(smtp.includes('passFingerprint'));
 assert(smtp.includes('createTransport({ host, port, secure, auth: { user, pass } })'));
});
test('SMTP provider and invalid sender errors never reveal raw exception or configuration values',()=>{
 assert(!smtp.includes('err?.message'));
 assert(!smtp.includes('it currently resolves to'));
 assert(smtp.includes('SMTP delivery failed; review restricted server diagnostics.'));
 assert(smtp.includes('SMTP_FROM_EMAIL is missing or invalid. Configure a verified sender address'));
});
test('Sheets errors do not echo provider response, candidate row, or connection token',()=>{
 const i=sheets.indexOf('async function gw(');
 const end=sheets.indexOf('export interface GoogleIntegrationSettings',i);
 assert(i>0&&end>i);
 const gateway=sheets.slice(i,end);
 assert(gateway.includes('Sheets API request failed (HTTP'));
 assert(!gateway.includes('res.status}:'));
 assert(gateway.includes('if (!res.ok) throw new Error('));
});
