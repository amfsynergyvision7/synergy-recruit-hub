/**
 * Legacy production containment for externally processed candidate resumes
 * and bulk Drive imports. This is intentionally a hard server-only hold with
 * NO environment-variable bypass. Requires independent privacy/security
 * review, record ownership validation, hosted UAT and approved release to
 * replace it with the reviewed candidate AI integration.
 */
export const CRM_LEGACY_CANDIDATE_AI_HOLD = true as const;
export const CRM_LEGACY_DRIVE_BULK_IMPORT_HOLD = true as const;
export function assertLegacyCandidateAiProcessingReleased(): void {
  if (CRM_LEGACY_CANDIDATE_AI_HOLD)
    throw new Error("Candidate AI processing is paused pending privacy and independent release approval");
}
export function assertLegacyDriveBulkImportReleased(): void {
  if (CRM_LEGACY_DRIVE_BULK_IMPORT_HOLD)
    throw new Error("Drive bulk import is paused pending privacy and independent release approval");
}
