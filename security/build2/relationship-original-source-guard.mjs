import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path='supabase/migrations/20260513091605_0748e094-a67e-47ca-a5a5-0040593d766f.sql';
const buf=readFileSync(path);
const hash=createHash('sha1').update('blob '+buf.length).update(Buffer.from([0])).update(buf).digest('hex');
if(hash!=='ced1eef233c67c5f22de3aee70e072afb66704c0')throw Error('Original relationship SQL changed; review and repin');
// Rehearsal does not resolve ambiguous multi-match backfill or authorize release.
const sql=buf.toString('utf8');
if(!sql.includes('UPDATE public.billing b')||!sql.includes('offers_stage_billing_trigger'))throw Error('Original financial relationship paths differ');
console.log('PASS: original relationship migration source pinned; multi-match and financial risks retained');
