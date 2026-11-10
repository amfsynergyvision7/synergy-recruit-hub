import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {validateReplayContract} from './migration-replay-contract-guard.mjs';
const directory=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
const config=JSON.parse(readFileSync(new URL('./disposable-replay-contract.json',import.meta.url),'utf8'));
test('pinned contract accepts only isolated synthetic replay subset',()=>{
 const r=validateReplayContract(config,directory);
 assert.equal(r.ready_for_disposable_subset_replay,true,JSON.stringify(r.issues));
 assert.equal(r.production_equivalent,false);assert.equal(r.release_authorized,false);
});
test('unsafe environment, network, financial mode and file scope each fail closed',()=>{
 for(const [key,value] of [['environment','production'],['fixture_type','real'],['network_access',true],['financial_workflows_enabled',true],['allow_production_connections',true],['migration_mode','all'],['files',[]]]){
  const r=validateReplayContract({...config,[key]:value},directory);
  assert.equal(r.ready_for_disposable_subset_replay,false,key);
 }
 assert.equal(validateReplayContract({},directory).ready_for_disposable_subset_replay,false);
});
