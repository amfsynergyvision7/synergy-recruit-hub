import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('AI transport enforces approval before external request',()=>{
 const source=read('src/lib/ai.server.ts');
 assert.match(source,/assertExternalAiApproved\(process\.env\.CRM_EXTERNAL_AI_APPROVED\)/);
});
test('SMTP transport enforces approval before sending',()=>{
 const source=read('src/lib/email.server.ts');
 assert.match(source,/assertSmtpApproved\(process\.env\.CRM_SMTP_DISPATCH_APPROVED\)/);
});
test('Browser Supabase client rejects project mismatch',()=>{
 const source=read('src/integrations/supabase/client.ts');
 assert.match(source,/expectedProject/);
 assert.match(source,/assertMatchingSupabaseProject\(SUPABASE_URL, expectedProject\)/);
});

test('Server and browser deny missing expected project identity',()=>{
 const server=read('src/integrations/supabase/auth-middleware.ts');
 const browser=read('src/integrations/supabase/client.ts');
 assert.match(server,/if \(!expectedProject\)/);
 assert.match(server,/Missing expected Supabase project ID/);
 assert.match(browser,/if \(!expectedProject\)/);
 assert.match(browser,/Missing expected project ID; refusing connection/);
});

test('Outbound transports remain disabled even when environment flags are true',()=>{
 const ai=read('src/lib/ai.server.ts');
 const email=read('src/lib/email.server.ts');
 assert.match(ai,/throw new Error\('SEC-12: external AI transport remains disabled/);
 assert.match(email,/throw new Error\('SEC-11: SMTP transport remains disabled/);
 assert.ok(ai.indexOf('external AI transport remains disabled') < ai.indexOf('assertExternalAiApproved(process.env.CRM_EXTERNAL_AI_APPROVED)'));
 assert.ok(email.indexOf('SMTP transport remains disabled') < email.indexOf('assertSmtpApproved(process.env.CRM_SMTP_DISPATCH_APPROVED)'));
});
