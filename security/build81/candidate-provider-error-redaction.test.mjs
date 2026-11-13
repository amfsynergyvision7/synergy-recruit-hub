import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ai=readFileSync(new URL('../../src/lib/ai.server.ts',import.meta.url),'utf8');
const resume=readFileSync(new URL('../../src/lib/resume-fetch.server.ts',import.meta.url),'utf8');
const aiStart=ai.indexOf('async function callGeminiJSON');
const aiEnd=ai.indexOf('const MATCH_SCHEMA',aiStart);
if(aiStart<0||aiEnd<=aiStart)throw new Error('Gemini call source drift');
const gemini=ai.slice(aiStart,aiEnd);

test('Gemini 4xx/5xx errors never echo upstream body or candidate prompt into user-visible exceptions',()=>{
 assert.match(gemini,/throw new Error\(`Gemini request failed \(HTTP \$\{res\.status\}\)\`\)/);
 assert.doesNotMatch(gemini,/throw new Error\([^\n]*(?:JSON\.stringify\(data\)|\$\{text\}|\$\{data\}|\$\{outputText\}|preview|raw response)/i);
 assert.doesNotMatch(gemini,/console\.(?:log|error|warn)\(/);
});
test('malformed Gemini structured output is redacted but normal successful JSON parsing remains intact',()=>{
 assert.match(gemini,/return JSON\.parse\(outputText\) as T/);
 assert.match(gemini,/Gemini returned invalid structured JSON/);
 assert.match(gemini,/Gemini returned an unsupported response format/);
 assert.doesNotMatch(gemini,/outputText\.slice\(|Raw response:|preview\.slice\(/);
});
test('resume PDF/DOCX parser exception never returns private filenames, embedded text or stack details',()=>{
 assert.match(resume,/catch \{\s*\/\/ PDF\/Word parsing libraries/);
 assert.match(resume,/error: "Couldn't read this resume file\. Check that it is a valid PDF or Word document\."/);
 assert.doesNotMatch(resume,/err\?\.message|error: \`Couldn't read the resume file: \$\{/);
});
test('candidate-facing resume generation functions cannot interpolate raw upstream messages directly',()=>{
 const downstream=[...ai.matchAll(/throw new Error\(\`Couldn't read this candidate's resume: \$\{resume\.error\}\`\)/g)];
 assert.equal(downstream.length,4);
 assert.match(resume,/return \{ ok: false, error: fetched\.error \}/);
 // Downstream messages are acceptable only because upstream fetch/parser
 // error paths are now bounded to generic descriptions and HTTP status.
 assert.doesNotMatch(resume,/return \{ ok: false, error: \$\{|error: err\.message/);
});
