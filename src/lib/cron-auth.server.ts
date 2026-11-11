import { createHash, timingSafeEqual } from 'node:crypto';
export interface CandidateSyncCronDependencies {
  getIntegration: () => Promise<{ auto_sync_enabled?: boolean | null; spreadsheet_id?: string | null } | null>;
  runSync: () => Promise<object>;
  recordFailure: () => Promise<void>;
}
export function isValidCronSecret(secret: unknown): secret is string {
  return typeof secret === 'string' && secret.length >= 32 && secret.length <= 1024 &&
    secret.trim() === secret && !/\s/.test(secret);
}
export function hasValidCronBearer(authorization: string | null, secret: unknown): boolean {
  if (!isValidCronSecret(secret)) return false;
  const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '');
  if (!match || match[1].length > 1024) return false;
  return timingSafeEqual(
    createHash('sha256').update(match[1], 'utf8').digest(),
    createHash('sha256').update(secret, 'utf8').digest(),
  );
}
function respond(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function handleCandidateSyncCron(
  request: Request,
  configuredSecret: string | undefined,
  dependencies: CandidateSyncCronDependencies,
): Promise<Response> {
  if (request.method !== 'POST') return respond({ ok: false, error: 'Method not allowed' }, 405);
  if (!isValidCronSecret(configuredSecret)) return respond({ ok: false, error: 'Sync unavailable' }, 503);
  if (!hasValidCronBearer(request.headers.get('authorization'), configuredSecret)) {
    return respond({ ok: false, error: 'Unauthorized' }, 401);
  }
  try {
    const integration = await dependencies.getIntegration();
    if (!integration?.auto_sync_enabled || !integration.spreadsheet_id) {
      return respond({ ok: true, skipped: true }, 200);
    }
    const result = await dependencies.runSync();
    return respond({ ok: true, ...result }, 200);
  } catch {
    try { await dependencies.recordFailure(); } catch { /* Never leak provider errors. */ }
    return respond({ ok: false, error: 'Scheduled sync failed' }, 500);
  }
}
