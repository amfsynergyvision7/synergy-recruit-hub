export type ApprovedProfile = { status?: string | null; is_active?: boolean | null } | null | undefined;
export type RoleRecord = { role?: string | null };
export function isApprovedActiveWithRole(
  profile: ApprovedProfile,
  memberships: readonly RoleRecord[] | null | undefined,
  allowedRoles: readonly string[],
): boolean {
  if (profile?.status !== 'approved' || profile?.is_active !== true) return false;
  // Exactly one role row is a release invariant. A duplicate or conflicting
  // membership must fail closed, matching the source-pinned Build80 RLS helper.
  // This matters because server-side functions may use a service-role client
  // after this check and therefore cannot rely on database RLS alone.
  if (!Array.isArray(memberships) || memberships.length !== 1 || allowedRoles.length === 0) return false;
  const role = memberships[0]?.role;
  return typeof role === 'string' && allowedRoles.includes(role);
}
