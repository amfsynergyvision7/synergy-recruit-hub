import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const expected={
 '20260517055116_3d1873db-f213-4a74-ae5e-7ea60e86a001.sql':"\n-- 1. notifications: restrict insert to self or admin\nDROP POLICY IF EXISTS \"insert notif\" ON public.notifications;\nCREATE POLICY \"insert notif\" ON public.notifications\n  FOR INSERT TO authenticated\n  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));\n\n-- 2. user_roles: only own row, admins see all\nDROP POLICY IF EXISTS \"approved read roles\" ON public.user_roles;\nCREATE POLICY \"self read role\" ON public.user_roles\n  FOR SELECT TO authenticated\n  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));\n\n-- 3. audit_logs: restrict client inserts to admin (SECURITY DEFINER triggers bypass RLS)\nDROP POLICY IF EXISTS \"insert audit\" ON public.audit_logs;\nCREATE POLICY \"insert audit\" ON public.audit_logs\n  FOR INSERT TO authenticated\n  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));\n\n-- 4. candidate_activities: remove permissive insert; only SECURITY DEFINER trigger writes\nDROP POLICY IF EXISTS \"insert activities\" ON public.candidate_activities;\n",
 '20260517055343_d3ca28ec-df58-4b32-ba79-cdc2aedc2157.sql':"\n-- 1. audit_logs read: admin only\nDROP POLICY IF EXISTS \"read audit\" ON public.audit_logs;\nCREATE POLICY \"read audit\" ON public.audit_logs\n  FOR SELECT TO authenticated\n  USING (public.has_role(auth.uid(), 'admin'::app_role));\n\n-- 2. sync_logs insert: admin only (server writes use service role)\nDROP POLICY IF EXISTS \"system insert sync logs\" ON public.sync_logs;\nCREATE POLICY \"admin insert sync logs\" ON public.sync_logs\n  FOR INSERT TO authenticated\n  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));\n\n-- 3. notifications: remove broadcast clause\nDROP POLICY IF EXISTS \"read notif\" ON public.notifications;\nCREATE POLICY \"read notif\" ON public.notifications\n  FOR SELECT TO authenticated\n  USING (user_id = auth.uid());\n"
};
export function verifyPolicySources(dir){
 return Object.entries(expected).every(([name,digest])=>{
  try{return readFileSync(join(dir,name),'utf8')===digest;}catch{return false;}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const ok=process.argv.length===3&&verifyPolicySources(process.argv[2]);
 console.log(ok?'PASS: both original RLS policy migrations match pinned source hashes':'BLOCK: RLS source changed');
 if(!ok)process.exitCode=1;
}
