import { createFileRoute } from '@tanstack/react-router';
import { getSavedGoogleIntegration, runCandidateSync } from '@/lib/sheets-sync.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { assertApprovedRole } from '@/lib/access-gates.server';
import { handleCandidateSyncCron } from '@/lib/cron-auth.server';
import { createSupabaseSyncLeaseOperations, withCandidateSyncLease } from '@/lib/sync-lease.server';

// REVIEW ONLY. No Vercel cron schedule or server secrets are activated here.
// Native Vercel Cron GET and trusted POST both require an authenticated bearer.
const handler = async ({ request }: { request: Request }) => handleCandidateSyncCron(request, {
  secret: process.env.CRON_SECRET,
  enabled: process.env.SHEETS_SYNC_CRON_ENABLED,
  ownerUserId: process.env.SHEETS_SYNC_OWNER_USER_ID,
}, {
  assertOwnerAdmin: (ownerId) => assertApprovedRole(ownerId, ['admin']),
  getIntegration: (ownerId) => getSavedGoogleIntegration({ backfillLegacy: false, userId: ownerId }),
  runSync: async (ownerId) => {
    const execution = await withCandidateSyncLease(
      ownerId,
      (heartbeat, token) => runCandidateSync({ triggeredBy: 'cron', userId: ownerId, leaseHeartbeat: heartbeat, leaseToken: token, atomicRowWrites: true }),
      createSupabaseSyncLeaseOperations(supabaseAdmin as any),
    );
    if (!execution.acquired) throw new Error('Candidate sync already leased');
    return execution.value;
  },
  recordFailure: async () => {
    const { error } = await supabaseAdmin.from('sync_logs').insert({
      module: 'candidates', triggered_by: 'cron', status: 'error',
      message: 'Scheduled candidate sync failed',
      errors: [{ row: 0, message: 'Scheduled candidate sync failed' }],
    });
    if (error) console.error('Unable to persist scheduled sync failure');
  },
});

export const Route = createFileRoute('/api/public/hooks/sheets-sync')({
  server: { handlers: { GET: handler, POST: handler } },
});
