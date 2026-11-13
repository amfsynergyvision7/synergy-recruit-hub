/**
 * Public careers applications are unauthenticated. A supplied email address
 * or phone number is not evidence of ownership of an existing CRM candidate.
 * Never link anonymous form input to a pre-existing candidate or disclose its ID.
 *
 * These checks do NOT verify a new applicant's identity. The independent
 * public_application release hold remains mandatory pending a proper
 * verified-identity, anti-abuse and atomic-write workflow.
 */
export function assertNoAnonymousCandidateCollision(args: {
  emailMatches: readonly unknown[] | null;
  emailError?: unknown;
  mobileMatches: readonly { mobile?: unknown }[] | null;
  mobileError?: unknown;
  normalizedMobile?: string | null;
  mobileProbeLimit: number;
}): void {
  const blocked = "Application requires independent identity verification";
  if(args.emailError || args.mobileError ||
    !Array.isArray(args.emailMatches) || !Array.isArray(args.mobileMatches) ||
    !Number.isSafeInteger(args.mobileProbeLimit) ||
    args.mobileProbeLimit < 2 ||
    args.mobileMatches.length >= args.mobileProbeLimit) {
    throw new Error(blocked);
  }
  if(args.emailMatches.length !== 0) throw new Error(blocked);
  // Never attach an anonymous application to a record on contact resemblance.
  // The mobile result is only a collision check; no candidate ID is returned.
  const target = args.normalizedMobile;
  if(target && args.mobileMatches.some(item => {
    const raw=item?.mobile;
    const digits=typeof raw==="string" ? raw.replace(/\D/g,"") : "";
    const canonical=digits.length>10?digits.slice(-10):digits;
    return canonical===target;
  })) throw new Error(blocked);
}
