/** Build160: immutable manual provider-confirmation hold. No SMTP or
 * environment overrides; independent reconciliation approval required.
 */
export const CRM_EMAIL_RECONCILIATION_RELEASE_HOLD = true as const;
export function assertCrmEmailReconciliationReleased():void {
 if(CRM_EMAIL_RECONCILIATION_RELEASE_HOLD)
  throw new Error("CRM email manual reconciliation paused pending independent authorization");
}
