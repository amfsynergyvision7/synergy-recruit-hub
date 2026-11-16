/**
 * Build199 read-only repository-owned caller inventory.
 * Audits local source paths; it CANNOT see deployed Edge Functions, external
 * services, dynamically named RPCs or production query logs.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,statSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,relative,join} from 'node:path';

const repo=fileURLToPath(new URL('../../',import.meta.url));
const extensions=/\.(ts|tsx|js|jsx|mjs|cjs|sql)$/;
const names=/\b(get_user_role|is_approved|has_role)\b/g;
const all=[];
function recurse(dir){
 for(const n of readdirSync(dir,{withFileTypes:true})){
  const full=join(dir,n.name);
  if(n.isDirectory()){
   if(!['node_modules','dist','.git','.next','coverage'].includes(n.name))recurse(full);
  }else if(n.isFile()&&extensions.test(n.name)){
   all.push(full);
  }
 }
}
for(const root of ['src','supabase'])recurse(resolve(repo,root));
const hits=[];
for(const full of all){
 const path=relative(repo,full).split('\\').join('/');
 const text=readFileSync(full,'utf8');
 for(const match of text.matchAll(names)){
  const line=text.slice(0,match.index).split('\n').length;
  const type=path==='src/integrations/supabase/types.ts'?'generated-type':
    path.startsWith('supabase/migrations/')?'migration-source':
    path.startsWith('supabase/functions/')?'edge-source':'application-source';
  hits.push({path,line,name:match[1],type});
 }
}

test('Build199 exact checked-out application/SQL inventory flags direct privileged helper names without user data',()=>{
 const byType={};
 for(const h of hits)byType[h.type]=(byType[h.type]??0)+1;
 const code=hits.filter(h=>h.type==='application-source'||h.type==='edge-source');
 const migration=hits.filter(h=>h.type==='migration-source');
 const typed=hits.filter(h=>h.type==='generated-type');
 assert.ok(all.length>=60,'Too few tracked application files — requires reviewer reconsideration');
 assert.ok(typed.length>=3,'Generated helper types disappeared — manual review before declaring no app call sites');
 // We deliberately fail on any newly introduced direct runtime call so a
 // qualified reviewer can inspect service and administrative compatibility.
 assert.deepEqual(code,[],
  'HOLD: Repository-owned direct helper source caller(s) found; independently review before changing privileged helper scope');
 console.log('BUILD199_REPOSITORY_CALLER_INVENTORY '+JSON.stringify({
   scannedFiles:all.length,
   generatedTypeMentions:typed.length,
   migrationSourceMentions:migration.length,
   directRuntimeNamedReferences:code.length,
   migrationPaths:[...new Set(migration.map(h=>h.path))].sort(),
   externalDynamicAndDeployedCallerCoverage:'UNKNOWN_REQUIRES_OWNER_REVIEW'
 }));
 console.log('BUILD199_NO_DIRECT_NAMED_RPC_CALLERS_IN_TRACKED_RUNTIME_SOURCE_NOT_RELEASE_APPROVAL');
});
