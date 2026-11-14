import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { isApprovedActiveWithRole } from './approved-role-policy';
export type CRMRole = 'admin' | 'recruiter' | 'operations' | 'finance' | 'viewer';
export async function assertApprovedRole(userId: string, allowed: readonly CRMRole[]): Promise<void> {
  if (!userId || allowed.length === 0) throw new Error('Forbidden');
  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('status,is_active').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('user_roles').select('role').eq('user_id', userId),
  ]);
  if (profileError || rolesError || !isApprovedActiveWithRole(profile, roles, allowed)) {
    throw new Error('Forbidden');
  }
}
