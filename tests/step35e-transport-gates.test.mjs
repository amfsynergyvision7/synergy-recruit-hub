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
 assert.match(source,/actualHost !== \x60\$\{expectedProject\}\.supabase\.co\x60/);
});
