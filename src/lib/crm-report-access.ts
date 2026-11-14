/**
 * Build123 CRM browser reporting policy. Defense-in-depth only:
 * actual DB RLS, server ownership checks and independent acceptance must
 * enforce authorization. Finance and billing reporting remain INACTIVE.
 */
import { canMountApprovedCrm } from "./crm-shell-access";

export const FINANCIAL_ANALYTICS_RELEASE_HOLD = true as const;

type Profile = { id?: unknown; status?: unknown; is_active?: unknown } | null | undefined;
function approved(userId: string | null | undefined, profile: Profile, role: string | null | undefined) {
  return canMountApprovedCrm(userId, profile, role);
}
export function canReadPipelineReports(
  userId: string | null | undefined, profile: Profile, role: string | null | undefined,
): boolean {
  return approved(userId, profile, role) &&
    (role === "admin" || role === "operations" || role === "recruiter");
}
export function canReadAuditLogs(
  userId: string | null | undefined, profile: Profile, role: string | null | undefined,
): boolean {
  return approved(userId, profile, role) && role === "admin";
}
export function canReadFinancialAnalytics(
  userId: string | null | undefined, profile: Profile, role: string | null | undefined,
): boolean {
  return !FINANCIAL_ANALYTICS_RELEASE_HOLD && approved(userId, profile, role) &&
    (role === "admin" || role === "finance");
}
