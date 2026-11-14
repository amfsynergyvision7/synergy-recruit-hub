/**
 * Build134: strict read-only reconciliation for the private administrator
 * directory. Client checks do not authorize access: the server must enforce
 * RLS, field grants, and role privileges independently.
 */
export const ADMIN_DIRECTORY_MAX_RECORDS = 2500 as const;

export interface DirectoryProfile {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
}
export interface DirectoryRole {
  id: string;
  user_id: string;
  role: string;
}
export type VerifiedDirectoryUser = DirectoryProfile & { role: string };

const ROLES = new Set(["admin", "recruiter", "operations", "finance", "viewer"]);
const STATES = new Set(["approved", "pending", "rejected", "suspended"]);

function nonempty(value: unknown): value is string {
  return typeof value === "string" && !!value.trim();
}

export function reconcileAdminDirectory(
  profiles: readonly DirectoryProfile[],
  roles: readonly DirectoryRole[],
): VerifiedDirectoryUser[] {
  if (!Array.isArray(profiles) || !Array.isArray(roles))
    throw new Error("Authorized directory sources unavailable");
  const seenProfiles = new Set<string>();
  for (const profile of profiles) {
    if (!profile || !nonempty(profile.id) || seenProfiles.has(profile.id) ||
        !nonempty(profile.full_name) || !nonempty(profile.email) ||
        !STATES.has(profile.status) || typeof profile.is_active !== "boolean" ||
        !nonempty(profile.created_at) ||
        (profile.department !== null && typeof profile.department !== "string"))
      throw new Error("Incomplete or ambiguous directory profile");
    seenProfiles.add(profile.id);
  }
  const roleMap = new Map<string, string>();
  for (const item of roles) {
    if (!item || !nonempty(item.id) || !nonempty(item.user_id) ||
        !ROLES.has(item.role) || !seenProfiles.has(item.user_id) ||
        roleMap.has(item.user_id))
      throw new Error("Ambiguous or unavailable directory role");
    roleMap.set(item.user_id, item.role);
  }
  // The legitimate unassigned status is not fabricated as an approved role.
  return profiles.map(profile => ({
    ...profile, role: roleMap.get(profile.id) ?? "unassigned",
  }));
}
