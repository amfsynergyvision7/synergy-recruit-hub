// Synthetic-only policy reference. No Supabase client or database calls.
export const permittedRoles = new Set(['admin','recruiter','operations']);
export const fieldsByRole = Object.freeze({
  admin: new Set(['candidate_name','interview_date','interview_status','interview_location','job_title']),
  recruiter: new Set(['candidate_name','interview_date','interview_status','interview_location','job_title']),
  operations: new Set(['candidate_name','interview_date','interview_status','interview_location','job_title'])
});
export function canRead({user,record,field,action='read'}) {
  if (action !== 'read' || !user || !record) return false;
  // Reference model is limited to verified interview records. Do not authorize\n  // other entities, missing identities or client-supplied operation scopes.\n  if (typeof user.id !== 'string' || !user.id.trim() || record.kind !== 'interview') return false;\n  if (user.status !== 'approved' || user.is_active !== true) return false;
  if (!permittedRoles.has(user.role) || !fieldsByRole[user.role].has(field)) return false;
  if (user.role === 'admin') return true; // admin operational scope only
  if (user.role === 'recruiter') return Boolean(user.id && record.assigned_recruiter === user.id);
  // Operations must have explicit verified interview authorization.
  // A missing mapping MUST NOT default to all interviews.
  if (user.role === 'operations') return Boolean(user.id && record.authorized_operations_user_id === user.id && record.kind === 'interview');
  return false;
}
export function projectAllowedFields({user,record}) {
  const result={};
  for(const field of Object.keys(record ?? {})) {
    if(canRead({user,record,field})) result[field]=record[field];
  }
  return result;
}
