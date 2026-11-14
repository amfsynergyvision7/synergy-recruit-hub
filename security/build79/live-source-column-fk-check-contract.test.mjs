import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PROJECT_ID,slotEmail} from '../build78/provision-nine-auth-users.mjs';
import {makeBaseFixture} from '../build78/seed-inert-base-fixture.mjs';
import {composeExtendedFixture,EXPECTED_ADMIN_COUNTS} from './compose-and-seed-remaining-fixture.mjs';

const source=JSON.parse(readFileSync(new URL('./hosted-catalog-source-snapshot.json',import.meta.url),'utf8'));
const hist=JSON.parse(readFileSync(new URL('../build41/signed-http-135-read-matrix.json',import.meta.url),'utf8'));
const accountId=i=>`0000000${i}-1111-4111-8111-00000000000${i}`;
const mkId=(prefix)=>{let i=0;return ()=>`${prefix}-cccc-4ccc-8ccc-${String(++i).padStart(12,'0')}`;};
const timestamp='2026-11-13T00:00:00.000Z';
const mapping={project_id:PROJECT_ID,users:Array.from({length:9},(_,i)=>({
 slot:i+1,id:accountId(i+1),email:slotEmail(i+1)
}))};
const base=makeBaseFixture(mapping,timestamp,mkId('aaaaaaaa'));
const extended=composeExtendedFixture(mapping,timestamp,mkId('bbbbbbbb'));
const rowsByTable={
 profiles:base.profiles,
 user_roles:base.roles,
 candidates:base.candidates,
 ...Object.fromEntries(extended.batches.map(b=>[b.table,b.rows]))
};
const allNames=Object.keys(rowsByTable);

test('real hosted schema inventory is exactly 19 tables / 239 columns / 42 FKs / 7 checks',()=>{
 assert.equal(source.project,PROJECT_ID);
 assert.equal(source.database_reads_only,true);
 assert.equal(source.business_records_copied,false);
 assert.equal(source.source_table_count,19);
 assert.equal(source.columns.length,239);
 assert.equal(source.foreign_keys.length,42);
 assert.equal(source.check_constraints.length,7);
 assert.equal(allNames.length,19);
 assert.deepEqual(new Set(source.columns.map(c=>c.table)),new Set(allNames));
});

test('every planned table row uses only real catalog column names and supplies all source NOT NULL columns',()=>{
 const cols=new Map();
 for(const c of source.columns){
  if(!cols.has(c.table))cols.set(c.table,new Map());
  cols.get(c.table).set(c.column,c);
 }
 for(const [table,rows] of Object.entries(rowsByTable)){
  const permitted=cols.get(table);
  assert(permitted && rows.length>0,'Missing table '+table);
  for(const row of rows){
   for(const key of Object.keys(row))assert(permitted.has(key),
    `No source column ${table}.${key}`);
   for(const c of permitted.values())if(c.not_null)
    assert(row[c.column]!==null && row[c.column]!==undefined,
     `Missing source NOT NULL ${table}.${c.column}`);
  }
 }
});

test('all 42 real source foreign keys point to another invented fixture row or one of nine Auth subjects',()=>{
 const refRows={...rowsByTable,'auth.users':mapping.users};
 for(const fk of source.foreign_keys){
  const referent=fk.ref_schema==='auth'?'auth.users':fk.ref_table;
  const rows=refRows[referent];
  assert(Array.isArray(rows),'Unknown FK target '+referent);
  for(const row of rowsByTable[fk.table] || []){
   const value=row[fk.column];
   if(value==null)continue;
   assert(rows.some(v=>v[fk.ref_column]===value),
    `Dangling source FK ${fk.table}.${fk.column} -> ${referent}.${fk.ref_column}`);
  }
 }
});

test('seven live CHECK constraints are satisfied by explicit inert values',()=>{
 const names=new Set(source.check_constraints.map(c=>c.constraint));
 assert.deepEqual(names,new Set([
  'app_settings_singleton','google_integrations_header_row_positive',
  'google_integrations_last_synced_row_positive',
  'google_integrations_sync_frequency_positive','workflow_rules_action_type_check',
  'workflow_rules_notify_target_check','workflow_rules_table_name_check'
 ]));
 const app=rowsByTable.app_settings[0],g=rowsByTable.google_integrations[0];
 const w=rowsByTable.workflow_rules[0];
 assert.equal(app.id,1);
 assert(g.header_row>=1 && g.last_synced_row>=1 && g.sync_frequency_minutes>=1);
 assert(['notify','update_field'].includes(w.action_type));
 assert(['assigned_recruiter','role:admin','role:recruiter','role:operations','role:finance','role:viewer'].includes(w.notify_target));
 assert(['candidates','submissions','interviews','offers','billing','clients'].includes(w.table_name));
 assert.equal(w.is_active,false);
});

test('all 15 actual historical admin read matrix counts align with generated table cardinalities',()=>{
 const historical=hist.read_cases.filter(c=>c.sub==='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
 assert.equal(historical.length,15);
 assert.deepEqual(new Set(historical.map(c=>c.table)),new Set(Object.keys(EXPECTED_ADMIN_COUNTS)));
 for(const c of historical){
  assert.equal(c.expected,EXPECTED_ADMIN_COUNTS[c.table],c.table+' blueprint drift');
  assert.equal(rowsByTable[c.table].length,c.expected,c.table+' actual fixture rows');
 }
});

test('no fixture row contains a real email domain, web connection, or active automation instruction',()=>{
 for(const [table,rows] of Object.entries(rowsByTable)){
  for(const row of rows){
   for(const [name,v] of Object.entries(row)){
    if((name==='email'||name==='to_email'||name==='google_account_email') && v != null){
     assert.match(v,/@example\.invalid$/i,table+'.'+name);
    }
    if(['sheet_url','spreadsheet_id','resume_import_folder_url','joining_date','invoice_number'].includes(name))
     assert.equal(v,null,table+'.'+name);
   }
  }
 }
 assert.equal(rowsByTable.workflow_rules[0].is_active,false);
 assert.equal(rowsByTable.integrations[0].auto_sync,false);
 assert.equal(rowsByTable.google_integrations[0].auto_sync_enabled,false);
 assert.equal(rowsByTable.email_log[0].status,'synthetic_never_sent');
 assert.equal(rowsByTable.sync_logs[0].status,'never_run');
});
