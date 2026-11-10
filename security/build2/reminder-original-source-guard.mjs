import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path='supabase/migrations/20260929060000_reminder_automation.sql';
const buf=readFileSync(path);
const hash=createHash('sha1').update('blob '+buf.length).update(Buffer.from([0])).update(buf).digest('hex');
if(hash!=='cb28b85c3c814f0158768d6a1ab91d39860885d0')throw Error('Original reminder SQL drifted; review and repin before replay');
console.log('PASS: exact original reminder migration pinned');
