/**
 * Browser-only CRM mount guard. Server role checks and RLS are authoritative.
 */
const appRoles = new Set(["admin", "recruiter", "operations", "finance", "viewer"]);

export function canMountApprovedCrm(
  userId: string | null | undefined,
  profile: { id?: unknown; status?: unknown; is_active?: unknown } | null | undefined,
  role: string | null | undefined,
): boolean {
  return typeof userId === "string" && userId.length > 0 &&
    profile?.id === userId &&
    profile.status === "approved" &&
    profile.is_active === true &&
    typeof role === "string" && appRoles.has(role);
}
