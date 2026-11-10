import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path='supabase/migrations/20260512131020_8bd78994-f2ec-4e2b-a8f1-6838de651c80.sql';
const buf=readFileSync(path);
const hash=createHash('sha1').update('blob '+buf.length).update(Buffer.from([0])).update(buf).digest('hex');
if(hash!=='ad1b3400c6b00a4dd4e764b01dec53296144b3b6')throw Error('Original baseline SQL changed; review and repin');
// A static guard is not approval: provisioning in this file contains a hardcoded identity exception.
const sql=buf.toString('utf8');
if(!/v_is_primary\s+BOOLEAN\s*:=\s*lower\(NEW\.email\)\s*=/.test(sql))throw Error('Baseline bootstrap identity assumption changed');
console.log('PASS: pinned original baseline SQL and flag retained bootstrap privilege-exception review');
