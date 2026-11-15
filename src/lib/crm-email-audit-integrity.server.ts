/**
 * Build155: hard, server-only CRM email audit integrity interlock.
 * This is not an env flag. Release requires independently reviewed RPC/
 * outbox, idempotency, reconciliation, access policy and signed hosted UAT.
 */
export const CRM_EMAIL_AUDIT_INTEGRITY_RELEASE_HOLD = true as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reservationError = "CRM email audit reservation unavailable; delivery blocked";
const settlementError = "CRM email delivery outcome requires manual reconciliation; do not retry";

export function assertCrmEmailAuditIntegrityReleased(): void {
  if (CRM_EMAIL_AUDIT_INTEGRITY_RELEASE_HOLD)
    throw new Error("CRM email audit integrity is paused pending independent release approval");
}
export function confirmCrmEmailAuditReservation(args: {
  row: unknown; error: unknown; expected: {
    id: string; actorId: string; relatedTable: "candidates"|"clients"; relatedId: string;
  };
}): void {
  const {row,error,expected}=args;
  if(error||!row||typeof row!=="object"||
     !uuid.test(expected.id)||!uuid.test(expected.actorId)||
     !uuid.test(expected.relatedId)||
     !["candidates","clients"].includes(expected.relatedTable))
    throw new Error(reservationError);
  const r=row as Record<string,unknown>;
  if(r.id!==expected.id||r.sent_by!==expected.actorId||
     r.related_table!==expected.relatedTable||
     r.related_id!==expected.relatedId||r.status!=="pending")
    throw new Error(reservationError);
}
export function crmEmailOutcomeStatus(outcome: unknown): "sent"|"unknown" {
  if(!outcome||typeof outcome!=="object")return "unknown";
  return (outcome as {success?:unknown}).success===true?"sent":"unknown";
}
export function confirmCrmEmailAuditSettlement(args:{
  row: unknown; error: unknown; expected: {id:string;status:"sent"|"unknown"};
}): void {
  const {row,error,expected}=args;
  if(error||!row||typeof row!=="object"||!uuid.test(expected.id)||
     !["sent","unknown"].includes(expected.status))
    throw new Error(settlementError);
  const r=row as Record<string,unknown>;
  if(r.id!==expected.id||r.status!==expected.status)
    throw new Error(settlementError);
}
export function crmEmailDeliveryReconciliationError():Error {
  return new Error(settlementError);
}
