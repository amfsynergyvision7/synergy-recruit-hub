/**
 * Build82: server-only hard release interlock for external effects and public
 * anonymous/service-role writes. Not a feature flag: environment variables
 * must NOT bypass this hold. Independent signed governance + security +
 * hosted acceptance are required before a reviewed code change can remove it.
 */
export const CRM_OUTBOUND_EMAIL_RELEASE_HOLD = true as const;
export const CRM_INTERVIEW_SCHEDULING_RELEASE_HOLD = true as const;
export const CRM_PUBLIC_APPLICATION_RELEASE_HOLD = true as const;
export const CRM_PUBLIC_CAREERS_PUBLISH_RELEASE_HOLD = true as const;
export const CRM_CANDIDATE_AI_PROCESSING_RELEASE_HOLD = true as const;
export const CRM_DRIVE_BULK_IMPORT_RELEASE_HOLD = true as const;
export const CRM_CANDIDATE_SYNC_RELEASE_HOLD = true as const;
export const CRM_INTEGRATION_CONFIGURATION_RELEASE_HOLD = true as const;

export type PausedExternalEffect='crm_email'|'interview_scheduling'|'public_application'|'careers_publication'|'candidate_ai_processing'|'drive_bulk_import'|'candidate_sync'|'integration_configuration';
export function assertExternalEffectReleased(action:PausedExternalEffect):void {
  switch(action) {
    case 'crm_email':
      if(CRM_OUTBOUND_EMAIL_RELEASE_HOLD)throw new Error('CRM email delivery is paused pending release approval');
      return;
    case 'interview_scheduling':
      if(CRM_INTERVIEW_SCHEDULING_RELEASE_HOLD)throw new Error('Interview scheduling changes are paused pending release approval');
      return;
    case 'public_application':
      if(CRM_PUBLIC_APPLICATION_RELEASE_HOLD)throw new Error('Public job applications are paused pending release approval');
      return;
    case 'careers_publication':
      if(CRM_PUBLIC_CAREERS_PUBLISH_RELEASE_HOLD)throw new Error('Public career postings are paused pending publication approval');
      return;
    case 'candidate_ai_processing':
      if(CRM_CANDIDATE_AI_PROCESSING_RELEASE_HOLD)throw new Error('Candidate AI processing is paused pending privacy and release approval');
      return;
    case 'drive_bulk_import':
      if(CRM_DRIVE_BULK_IMPORT_RELEASE_HOLD)throw new Error('Drive resume bulk import is paused pending privacy and release approval');
      return;
    case 'candidate_sync':
      if(CRM_CANDIDATE_SYNC_RELEASE_HOLD)throw new Error('Candidate synchronization is paused pending release approval');
      return;
    case 'integration_configuration':
      if(CRM_INTEGRATION_CONFIGURATION_RELEASE_HOLD)throw new Error('Integration configuration changes are paused pending release approval');
      return;
  }
  // Runtime safety if typed callers or compiled JS bypass the TS union.
  throw new Error('Unapproved external-effect operation');
}
export function isExternalEffectPaused(action:PausedExternalEffect):boolean {
  return action==='crm_email'?CRM_OUTBOUND_EMAIL_RELEASE_HOLD:
    action==='interview_scheduling'?CRM_INTERVIEW_SCHEDULING_RELEASE_HOLD:
    action==='public_application'?CRM_PUBLIC_APPLICATION_RELEASE_HOLD:
    action==='careers_publication'?CRM_PUBLIC_CAREERS_PUBLISH_RELEASE_HOLD:
    action==='candidate_ai_processing'?CRM_CANDIDATE_AI_PROCESSING_RELEASE_HOLD:
    action==='drive_bulk_import'?CRM_DRIVE_BULK_IMPORT_RELEASE_HOLD:
    action==='candidate_sync'?CRM_CANDIDATE_SYNC_RELEASE_HOLD:
    action==='integration_configuration'?CRM_INTEGRATION_CONFIGURATION_RELEASE_HOLD:true;
}
