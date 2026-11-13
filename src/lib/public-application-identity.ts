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

/**
 * Applicant-supplied resume links may later be shown to a recruiter. Only
 * conventional public HTTPS URLs are accepted; a generic .url() validator
 * can also parse javascript:, data:, file:, custom ports and loopback hosts.
 * This is link validation, NOT a guarantee that linked files are safe.
 */
export function normalizeSafePublicResumeUrl(input: unknown): string | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "string" || input.length > 2048 ||
      /[\u0000-\u001f\u007f\\]/.test(input)) {
    throw new Error(PUBLIC_APPLICATION_ERROR);
  }
  const value = input.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    // Explicit :443 is normalized away by URL.port but the database's
    // stricter public-HTTPS pattern intentionally disallows all custom ports.
    const rawAuthority = value.replace(/^https:\/\//i, "").split(/[/?#]/, 1)[0];
    if (parsed.protocol !== "https:" || parsed.port ||
        rawAuthority.includes(":") || host.endsWith(".") ||
        parsed.username || parsed.password ||
        !host.includes(".") || host.startsWith(".") ||
        !/^[a-z0-9.-]+$/.test(host) || host.includes("..") ||
        /\.(?:localhost|local|internal|invalid|test|example|onion)$/.test(host) ||
        /^\d+(?:\.\d+){3}$/.test(host) || host.startsWith("[") ||
        !/[a-z]{2,}$/.test(host)) {
      throw new Error(PUBLIC_APPLICATION_ERROR);
    }
    return parsed.href;
  } catch {
    throw new Error(PUBLIC_APPLICATION_ERROR);
  }
}
