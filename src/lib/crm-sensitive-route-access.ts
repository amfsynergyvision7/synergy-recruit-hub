/**
 * Build125 browser gates for private directories and candidate activity.
 * Backend RLS and audit/role server policies are authoritative.
 */
import { canMountApprovedCrm } from "./crm-shell-access.ts";

type Profile = { id?: unknown; status?: unknown; is_active?: unknown } | null | undefined;
export const CANDIDATE_AI_BROWSER_RELEASE_HOLD = true as const;

export function canReadPrivateUserDirectory(
  userId: string | null | undefined, profile: Profile, role: string | null | undefined,
): boolean {
  return canMountApprovedCrm(userId, profile, role) && role === "admin";
}

export function canReadCandidateActivityMetadata(
  userId: string | null | undefined, profile: Profile, role: string | null | undefined,
): boolean {
  // Timeline is cross-candidate, so keep it strictly admin-only until a
  // candidate/assigned-recruiter RLS model receives hosted acceptance.
  return canMountApprovedCrm(userId, profile, role) && role === "admin";
}

export function canUseCandidateAiMatching(
  userId: string | null | undefined, profile: Profile, role: string | null | undefined,
): boolean {
  return !CANDIDATE_AI_BROWSER_RELEASE_HOLD &&
    canMountApprovedCrm(userId, profile, role) &&
    (role === "admin" || role === "recruiter");
}
