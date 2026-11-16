import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  downloadRemoteBounded,isTrustedDriveHost,isTrustedSupabaseLogoUrl,readResponseTextBounded,
} from '../../src/lib/safe-remote-download.server.ts';

const base='https://drive.google.com/uc?export=download&id=abcdefghij';
const policy={allowedHost:isTrustedDriveHost,maxBytes:64,timeoutMs:1000,maxRedirects:2};
const fake=(body='abc',options={})=>async()=>new Response(body,{status:200,...options});

test('Build84 trusted Drive redirect host allowlist excludes spoofing and local addresses',()=>{
 for(const host of ['drive.google.com','drive.usercontent.google.com','drive.googleusercontent.com','lh3.googleusercontent.com']){
  assert.equal(isTrustedDriveHost(host),true,host);
 }
 for(const host of ['drive.google.com.evil.invalid','evilgoogleusercontent.com','localhost','127.0.0.1','metadata.google.internal','example.com']){
  assert.equal(isTrustedDriveHost(host),false,host);
 }
});
test('Build84 invalid URLs fail before ever calling network',async()=>{
 let requests=0;
 const request=async()=>{requests++;throw new Error('should not run');};
 for(const url of ['http://drive.google.com/uc','https://drive.google.com.evil.invalid/uc','https://127.0.0.1/','https://localhost/','https://a:secret@drive.google.com/uc','https://drive.google.com:8443/uc']){
  await assert.rejects(downloadRemoteBounded(url,policy,request),/not approved/);
 }
 assert.equal(requests,0);
});
test('Build84 rejects overlong redirect chain, unapproved redirect and downgrade',async()=>{
 for(const target of ['http://drive.google.com/uc','http://127.0.0.1/','https://evil.invalid/','https://drive.google.com.evil.invalid/']){
  let calls=0;
  await assert.rejects(downloadRemoteBounded(base,policy,async()=>{calls++;return new Response(null,{status:302,headers:{location:target}});}),/not approved/);
  assert.equal(calls,1);
 }
 let calls=0;
 await assert.rejects(downloadRemoteBounded(base,policy,async()=>{calls++;return new Response(null,{status:302,headers:{location:'/uc?redirect=again'}});}),/too many times/);
 assert.equal(calls,3);
});
test('Build84 follows only a bounded allowed-host redirect and returns bounded bytes',async()=>{
 let count=0;
 const result=await downloadRemoteBounded(base,policy,async(url,init)=>{
  count++;
  assert.equal(init.redirect,'manual');
  assert.equal(init.credentials,'omit');
  if(count===1)return new Response(null,{status:302,headers:{location:'https://drive.usercontent.google.com/download?id=abcdefghij'}});
  assert(url.startsWith('https://drive.usercontent.google.com/'));
  return new Response('short file',{status:200,headers:{'content-type':'application/octet-stream'}});
 });
 assert.equal(count,2);
 assert.equal(result.body.toString(),'short file');
 assert.equal(result.contentType,'application/octet-stream');
});
test('Build84 refuses high content-length without downloading body',async()=>{
 const r=async()=>new Response('x',{status:200,headers:{'content-length':'1000'}});
 await assert.rejects(downloadRemoteBounded(base,policy,r),/too large/);
});
test('Build84 enforces streaming byte budget even with missing Content-Length',async()=>{
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(33));controller.enqueue(new Uint8Array(33));controller.close();}});
 const request=async()=>new Response(body,{status:200});
 await assert.rejects(downloadRemoteBounded(base,policy,request),/too large/);
});
test('Build84 rejects unsafe download policies and excess redirects',async()=>{
 for(const p of [{...policy,maxBytes:0},{...policy,maxBytes:20*1024*1024},{...policy,timeoutMs:0},{...policy,timeoutMs:999999},{...policy,maxRedirects:8}]){
  await assert.rejects(downloadRemoteBounded(base,p,async()=>new Response('x')),/policy is invalid/);
 }
});
test('Build84 public image URL must be this deployment’s own Supabase Storage object',()=>{
 const expected='https://test-tenant.supabase.co';
 for(const u of ['https://test-tenant.supabase.co/storage/v1/object/public/assets/logo.png','https://test-tenant.supabase.co/storage/v1/object/public/assets/my%20logo.jpg']){
  assert.equal(isTrustedSupabaseLogoUrl(u,expected),true,u);
 }
 for(const u of [
  'http://test-tenant.supabase.co/storage/v1/object/public/logo.png',
  'https://test-tenant.supabase.co.evil.invalid/storage/v1/object/public/a.png',
  'https://other-tenant.supabase.co/storage/v1/object/public/logo.png',
  'https://test-tenant.supabase.co/storage/v1/object/sign/logo.png',
  'https://127.0.0.1/admin',
  'https://test-tenant.supabase.co/storage/v1/object/public/',
  'https://user:pass@test-tenant.supabase.co/storage/v1/object/public/logo.png',
  'https://test-tenant.supabase.co:8443/storage/v1/object/public/logo.png',
  'https://test-tenant.supabase.co/storage/v1/object/public/logo.png#secret',
 ])assert.equal(isTrustedSupabaseLogoUrl(u,expected),false,u);
 assert.equal(isTrustedSupabaseLogoUrl('https://test-tenant.supabase.co/storage/v1/object/public/x','http://test-tenant.supabase.co'),false);
});
test('Build84 resume fetch and PDF logo use bounded trusted network paths exclusively',()=>{
 const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
 const resume=read('src/lib/resume-fetch.server.ts');
 const logo=read('src/lib/resume-pdf.server.ts');
 assert.match(resume,/downloadRemoteBounded\(baseUrl, policy\)/);
 assert.match(resume,/maxBytes: 8 \* 1024 \* 1024/);
 assert.match(resume,/maxRedirects: 4/); // explicit policy bound
 assert.match(resume,/url\.hostname !== "drive\.google\.com"/);
 assert.doesNotMatch(resume,/fetch\(baseUrl,\s*\{\s*redirect:\s*"follow"/);
 assert.match(logo,/isTrustedSupabaseLogoUrl\(logoUrl, projectUrl\)/);
 assert.match(logo,/maxBytes: 512 \* 1024/);
 assert.match(logo,/maxRedirects: 0/);
 assert.match(logo,/return null/);
 assert.doesNotMatch(logo,/await fetch\(logoUrl\)/);
});


test('Build84 provider response reader accepts small JSON and rejects a large Content-Length',async()=>{
 assert.equal(await readResponseTextBounded(new Response('{"ok":true}'),64),'{"ok":true}');
 await assert.rejects(readResponseTextBounded(new Response('x',{headers:{'content-length':'4096'}}),64),/exceeded safe size/);
});
test('Build84 provider response reader rejects oversized chunked stream even without Content-Length',async()=>{
 const body=new ReadableStream({start(ctrl){ctrl.enqueue(new Uint8Array(60));ctrl.enqueue(new Uint8Array(60));ctrl.close();}});
 await assert.rejects(readResponseTextBounded(new Response(body),64),/exceeded safe size/);
});
test('Build84 Gemini and Drive API response size limits and no-redirect policy are enforced',()=>{
 const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
 const ai=read('src/lib/ai.server.ts');
 const drive=read('src/lib/drive-import.server.ts');
 assert(ai.includes('redirect: "error"'));
 assert(ai.includes('signal: AbortSignal.timeout(30000)'));
 assert(ai.includes('readResponseTextBounded(res, 512 * 1024)'));
 assert(!ai.includes('const text = await res.text()'));
 assert(drive.includes('downloadRemoteBounded('));
 assert(drive.includes('DRIVE_LIST_ENDPOINT'));
 assert(drive.includes('allowedHost: host => host === "www.googleapis.com"'));
 assert(drive.includes('maxBytes: 2 * 1024 * 1024'));
 assert(drive.includes('maxRedirects: 0'));
 assert(!drive.includes('const message = data?.error?.message'));
});


test('Build84 Drive folder traversal cannot use arbitrary URL, infinite pages or cyclic tokens',()=>{
 const drive=readFileSync(new URL('../../src/lib/drive-import.server.ts',import.meta.url),'utf8');
 assert(drive.includes('url.protocol !== "https:" || url.hostname !== "drive.google.com"'));
 assert(drive.includes('url.port || url.username || url.password'));
 assert(drive.includes('if (++pageCount > 10)'));
 assert(drive.includes('seenTokens.has(pageToken)'));
 assert(drive.includes('seenTokens.add(pageToken)'));
 assert(drive.includes('Drive folder listing exceeded the maximum page count'));
 assert(drive.includes('Drive folder pagination repeated a token'));
});

test('Build98 header-only Google API key never enters URL, redirects, or other hosts',async()=>{
 const secret='AIza_123456789012345678901234567890ABC';
 const url='https://www.googleapis.com/drive/v3/files?pageSize=200';
 const p={allowedHost:host=>host==='www.googleapis.com',maxBytes:128,timeoutMs:1000,
  maxRedirects:0,googleApiKey:secret};
 let calls=0;
 const ok=await downloadRemoteBounded(url,p,async(address,init)=>{
  calls++;
  assert.equal(new URL(address).hostname,'www.googleapis.com');
  assert(!address.includes(secret),'Secret must not appear in URL');
  assert.equal(init?.headers?.['x-goog-api-key'],secret);
  assert.equal(init?.redirect,'manual');
  assert.equal(init?.credentials,'omit');
  return new Response('{"files":[]}',{status:200});
 });
 assert.equal(calls,1);
 assert.equal(ok.body.toString(),'{"files":[]}');
 const noFetch=async()=>{calls++;throw new Error('Untrusted host must be denied before fetch')};
 for(const badUrl of [
  'https://drive.google.com/drive/v3/files',
  'https://evil.invalid/drive/v3/files',
  'https://www.googleapis.com.evil.invalid/drive/v3/files',
  'https://www.googleapis.com/drive/v3/files?key='+secret,
  'http://www.googleapis.com/drive/v3/files'
 ])await assert.rejects(downloadRemoteBounded(badUrl,p,noFetch),/approved/);
 assert.equal(calls,1);
 for(const bad of [
  {...p,maxRedirects:1},
  {...p,maxRedirects:undefined},
  {...p,googleApiKey:'x'},
  {...p,googleApiKey:'\r\nX-Leak:1'}
 ])await assert.rejects(downloadRemoteBounded(url,bad,noFetch),/policy is invalid/);
 assert.equal(calls,1);
 let redirects=0;
 await assert.rejects(downloadRemoteBounded(url,p,async(_address,init)=>{
  redirects++;assert.equal(init.headers['x-goog-api-key'],secret);
  return new Response(null,{status:302,headers:{location:'https://evil.invalid/stolen'}});
 }),/too many times/);
 assert.equal(redirects,1,'Never call redirected endpoint with Google key');
});
test('Build98 Google Drive folder listing has no query-string API key and exact host-pinned credentials',()=>{
 const s=readFileSync(new URL('../../src/lib/drive-import.server.ts',import.meta.url),'utf8');
 const first=s.slice(s.indexOf('async function listFolderFiles('),
   s.indexOf('export type DriveImportFileOutcome'));
 assert(!first.includes('key: apiKey,'));
 assert(first.includes('googleApiKey: apiKey,'));
 assert(first.includes('maxRedirects: 0'));
 assert(first.includes('allowedHost: host => host === "www.googleapis.com"'));
 const source=readFileSync(new URL('../../src/lib/safe-remote-download.server.ts',import.meta.url),'utf8');
 assert(source.includes('"x-goog-api-key": policy.googleApiKey'));
 assert(source.includes('current.searchParams.has("key")'));
 assert(source.includes('current.hostname !== "www.googleapis.com"'));
});
