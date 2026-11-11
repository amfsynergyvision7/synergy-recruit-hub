export type ApprovedProfile = { status?: string | null; is_active?: boolean | null } | null | undefined;
export type RoleRecord = { role?: string | null };
export function isApprovedActiveWithRole(
  profile: ApprovedProfile,
  memberships: readonly RoleRecord[] | null | undefined,
  allowedRoles: readonly string[],
): boolean {
  if (profile?.status !== 'approved' || profile?.is_active !== true) return false;
  if (!Array.isArray(memberships) || allowedRoles.length === 0) return false;
  return memberships.some((record) => typeof record.role === 'string' && allowedRoles.includes(record.role));
}
