import { randomUUID } from 'node:crypto';

/** A lease is shared in PostgreSQL, not in serverless process memory. */
export interface CandidateSyncLeaseOperations {
  claim(ownerId: string, token: string): Promise<boolean>;
  renew(ownerId: string, token: string): Promise<boolean>;
  release(ownerId: string, token: string): Promise<boolean>;
}
export type CandidateSyncLeaseExecution<T> =
  | { acquired: false }
  | { acquired: true; value: T };

/**
 * Fail closed if any RPC is missing, access is denied or the lease is lost.
 * This is best-effort fencing: independent row writes are not transactional.
 */
export async function withCandidateSyncLease<T>(
  ownerId: string,
  work: (heartbeat: () => Promise<void>) => Promise<T>,
  operations: CandidateSyncLeaseOperations,
  tokenFactory: () => string = randomUUID,
): Promise<CandidateSyncLeaseExecution<T>> {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(ownerId)) {
    throw new Error('Invalid candidate sync owner');
  }
  const token = tokenFactory();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token)) {
    throw new Error('Invalid lease token');
  }
  if (!(await operations.claim(ownerId, token))) return { acquired: false };
  const heartbeat = async () => {
    if (!(await operations.renew(ownerId, token))) throw new Error('Candidate sync lease lost');
  };
  let result: T | undefined;
  let caught: unknown;
  let failed = false;
  try {
    await heartbeat();
    result = await work(heartbeat);
    await heartbeat();
  } catch (error) {
    failed = true;
    caught = error;
  }
  let released = false;
  try { released = await operations.release(ownerId, token); }
  catch { /* Fail closed if the release RPC cannot be confirmed. */ }
  if (!released) throw new Error('Candidate sync lease release could not be confirmed');
  if (failed) throw caught;
  return { acquired: true, value: result as T };
}

export interface SyncLeaseRpcClient {
  rpc(name: string, parameters: Record<string, string>): Promise<{ data: unknown; error: unknown }>;
}
export function createSupabaseSyncLeaseOperations(client: SyncLeaseRpcClient): CandidateSyncLeaseOperations {
  async function invoke(action: string, ownerId: string, token: string): Promise<boolean> {
    const { data, error } = await client.rpc(action, { p_owner: ownerId, p_token: token });
    if (error || typeof data !== 'boolean') throw new Error('Candidate sync lease RPC unavailable');
    return data;
  }
  return {
    claim: (ownerId, token) => invoke('crm_claim_candidate_sync_lease', ownerId, token),
    renew: (ownerId, token) => invoke('crm_refresh_candidate_sync_lease', ownerId, token),
    release: (ownerId, token) => invoke('crm_release_candidate_sync_lease', ownerId, token),
  };
}
