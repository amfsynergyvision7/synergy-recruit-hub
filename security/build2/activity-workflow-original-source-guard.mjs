import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sources=[
 ['20260517054652_a336ca88-33cd-4bcd-8117-8af35eb851db.sql','15e487afbadc3f470f17d5b0a54524f5c369878d'],
 ['20260930060000_workflow_rules.sql','bd479fb0597f0d6c75277c44b01f03ba6fc18332'],
];
function blobHash(src){const buf=Buffer.from(src);return createHash('sha1').update(Buffer.from('blob '+buf.byteLength+'\\0')).update(buf).digest('hex');}
for(const [name,expected] of sources){
 const data=readFileSync('supabase/migrations/'+name,'utf8');
 const hash=blobHash(data);
 if(hash!==expected)throw Error('Original migration source changed: '+name+'; re-review and repin before replay');
}
console.log('PASS: both exact original activity and workflow migration sources pinned');
