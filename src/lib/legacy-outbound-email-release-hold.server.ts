/**
 * Emergency REVIEW-ONLY containment for the legacy main CRM email path.
 * Independent approval is needed before merge. There is intentionally no
 * environment variable that can enable SMTP or bypass this hold.
 *
 * The normal audited, recipient-bound journal protocol must replace the
 * legacy handler under a separately reviewed migration/release.
 */
export const CRM_LEGACY_OUTBOUND_EMAIL_RELEASE_HOLD = true as const;
export function assertCrmLegacyOutboundEmailReleased(): void {
  if (CRM_LEGACY_OUTBOUND_EMAIL_RELEASE_HOLD) {
    throw new Error("CRM outbound email is paused pending independent security and correspondence audit approval");
  }
}
