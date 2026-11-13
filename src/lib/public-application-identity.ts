/**
 * Pure fail-closed boundary for the future independently verified applicant
 * workflow. Build104 has NO proof issuer, rate limiter or public activation.
 * A contact email/mobile alone must never authorize an existing CRM record.
 */
const PUBLIC_APPLICATION_ERROR = "Application could not be completed securely.";
const PUBLIC_VERIFICATION_ERROR = "Application requires independent identity verification";

export function requireVerifiedApplicantProofId(value: unknown): string {
  // Proof IDs come from independent high-entropy v4 issuance, not contacts.
  if (typeof value !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(PUBLIC_VERIFICATION_ERROR);
  }
  return value;
}

/** Never return internal database candidate/submission IDs or SQL errors. */
export function parseAtomicApplicationOutcome(value: unknown): { alreadyApplied: boolean } {
  if (value === "accepted") return { alreadyApplied: false };
  if (value === "already_applied") return { alreadyApplied: true };
  throw new Error(PUBLIC_APPLICATION_ERROR);
}
