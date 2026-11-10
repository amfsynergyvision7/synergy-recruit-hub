import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDisposableTarget} from './assert-disposable-db-target.mjs';
const baseline={CI:'true',PGHOST:'localhost',PGPORT:'5432',PGDATABASE:'build2_synthetic',PGUSER:'postgres',PGPASSWORD:'synthetic_test_only'};
test('exact synthetic service target passes',()=>assert.equal(assertDisposableTarget(baseline).safe,true));
test('remote hosts, live names, CI absence and connection overrides fail closed',()=>{
 for(const [key,value] of [['CI','false'],['PGHOST','db.example.com'],['PGPORT','6543'],['PGDATABASE','production'],['PGUSER','service_role'],['PGPASSWORD','secret'],['DATABASE_URL','postgres://remote'],['DIRECT_URL','postgres://remote'],['PGHOSTADDR','1.2.3.4'],['PGSERVICE','prod']]){
  assert.equal(assertDisposableTarget({...baseline,[key]:value}).safe,false,key);
 }
 assert.equal(assertDisposableTarget({}).safe,false);
});
