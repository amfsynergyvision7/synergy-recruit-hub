import { createHash, timingSafeEqual } from 'node:crypto';

export interface ScheduledSyncConfiguration {
  secret: string | undefined;
  enabled: string | undefined;
  ownerUserId: string | undefined;
}
export interface CandidateSyncCronDependencies {
  assertOwnerAdmin: (ownerId: string) => Promise<void>;
  getIntegration: (ownerId: string) => Promise<{
    user_id?: string | null;
    auto_sync_enabled?: boolean | null;
    spreadsheet_id?: string | null;
  } | null>;
  runSync: (ownerId: string) => Promise<{
    created?: number; updated?: number; skipped?: number; errors?: number;
  }>;
  recordFailure: () => Promise<void>;
}
export function isValidCronSecret(secret: unknown): secret is string {
  return typeof secret === 'string' && secret.length >= 32 && secret.length <= 1024 &&
    secret.trim() === secret && !/\s/.test(secret);
}
export function hasValidCronBearer(authorization: string | null, secret: unknown): boolean {
  if (!isValidCronSecret(secret)) return false;
  const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '');
  if (!match || match[0] !== authorization || match[1].length > 1024) return false;
  return timingSafeEqual(
    createHash('sha256').update(match[1], 'utf8').digest(),
    createHash('sha256').update(secret, 'utf8').digest(),
  );
}
export function isValidSyncOwnerId(owner: unknown): owner is string {
  return typeof owner === 'string' &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(owner);
}
function respond(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
/**
 * Synthetic-testable, fail-closed scheduler entrypoint. No live integration is
 * accessed until method, feature flag, configured owner, secret and role pass.
 * Native Vercel cron sends GET; trusted non-Vercel schedulers may POST.
 */
export async function handleCandidateSyncCron(
  request: Request,
  config: ScheduledSyncConfiguration,
  dependencies: CandidateSyncCronDependencies,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return respond({ ok: false, error: 'Method not allowed' }, 405);
  }
  if (config.enabled !== 'true' || !isValidCronSecret(config.secret) ||
      !isValidSyncOwnerId(config.ownerUserId)) {
    return respond({ ok: false, error: 'Sync unavailable' }, 503);
  }
  if (!hasValidCronBearer(request.headers.get('authorization'), config.secret)) {
    return respond({ ok: false, error: 'Unauthorized' }, 401);
  }
  const owner = config.ownerUserId;
  try {
    await dependencies.assertOwnerAdmin(owner);
    const integration = await dependencies.getIntegration(owner);
    if (!integration) return respond({ ok: true, skipped: true }, 200);
    if (integration.user_id !== owner) throw new Error('Integration owner mismatch');
    if (!integration.auto_sync_enabled || !integration.spreadsheet_id) {
      return respond({ ok: true, skipped: true }, 200);
    }
    const result = await dependencies.runSync(owner);
    if (result.errors !== 0) throw new Error('Scheduled sync reported errors');
    return respond({
      ok: true,
      created: count(result.created),
      updated: count(result.updated),
      skipped: count(result.skipped),
    }, 200);
  } catch {
    try { await dependencies.recordFailure(); } catch { /* Never leak provider/database errors. */ }
    return respond({ ok: false, error: 'Scheduled sync failed' }, 500);
  }
}
