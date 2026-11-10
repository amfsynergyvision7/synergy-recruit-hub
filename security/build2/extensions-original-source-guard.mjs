import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const f='supabase/migrations/20260513101842_cb1bc9ab-e5f4-4b42-b09a-60588844ca6c.sql';
const bytes=readFileSync(f);
const oid=createHash('sha1').update('blob '+bytes.length).update(Buffer.from([0])).update(bytes).digest('hex');
if(oid!=='1dfd6a86ed6c331a11f72b06b0d05462eb2fa790')throw Error('Original extension migration source changed; review and repin');
console.log('PASS: pinned original pg_cron and pg_net migration source');
