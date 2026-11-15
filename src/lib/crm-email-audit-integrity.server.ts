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
  const value=outcome as {success?:unknown; providerId?:unknown};
  // A provider acknowledgement without a usable correlation ID cannot be
  // proven or reconciled as a successful correspondence delivery.
  if(value.success!==true||typeof value.providerId!=="string")return "unknown";
  const id=value.providerId.trim();
  return id.length>0&&id.length<=256&&/^[\x21-\x7e]+$/.test(id)?"sent":"unknown";
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

/**
 * Build156: execute the actual source-level mail protocol with injectable
 * async boundaries. The route must first enforce BOTH immutable release
 * holds and role/record authorization. This function is deterministic and
 * uses no network, database, timers or environmental feature flags itself.
 *
 * A provider's result is uncertain if it lacks a valid correlation ID.
 * The protocol never resends or retries a prior attempt automatically.
 */
export type CrmEmailAttempt = {
  id:string;
  actorId:string;
  relatedTable:"candidates"|"clients";
  relatedId:string;
};
export type CrmAuditOperationResult={
  row:unknown; error:unknown;
};
export type CrmProviderOutcome={
  success:boolean; providerId?:string; error?:string;
};
export type CrmEmailAuditEffects={
  attempt:CrmEmailAttempt;
  reserve:()=>Promise<CrmAuditOperationResult>;
  deliver:()=>Promise<CrmProviderOutcome>;
  settle:(status:"sent"|"unknown",providerId:string|null)=>Promise<CrmAuditOperationResult>;
};

export async function executeCrmEmailAuditProtocol(effects:CrmEmailAuditEffects):
  Promise<{success:true}> {
  const expected={
    id:effects.attempt.id,
    actorId:effects.attempt.actorId,
    relatedTable:effects.attempt.relatedTable,
    relatedId:effects.attempt.relatedId,
  };
  // A thrown DB error is never mapped to success, and SMTP is not invoked.
  let reservation:CrmAuditOperationResult;
  try {
    reservation=await effects.reserve();
  } catch {
    throw new Error(reservationError);
  }
  confirmCrmEmailAuditReservation({
    row:reservation?.row,error:reservation?.error,expected,
  });

  // Once the provider is contacted, errors/timeout may imply acceptance.
  // Do not classify them as definite failure, and never auto-resend.
  let outcome:CrmProviderOutcome={success:false};
  try {
    outcome=await effects.deliver();
  } catch {
    // The pending audit record must be retained for manual reconciliation.
  }
  const status=crmEmailOutcomeStatus(outcome);
  const id=status==="sent"&&typeof outcome?.providerId==="string"
    ?outcome.providerId.trim():null;

  let settled:CrmAuditOperationResult;
  try {
    settled=await effects.settle(status,id);
  } catch {
    throw crmEmailDeliveryReconciliationError();
  }
  confirmCrmEmailAuditSettlement({
    row:settled?.row,error:settled?.error,
    expected:{id:effects.attempt.id,status},
  });
  if(status!=="sent")throw crmEmailDeliveryReconciliationError();
  return {success:true};
}
