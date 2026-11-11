import { createFileRoute } from '@tanstack/react-router';
import { getSavedGoogleIntegration, runCandidateSync } from '@/lib/sheets-sync.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { handleCandidateSyncCron } from '@/lib/cron-auth.server';
// REVIEW ONLY: protected POST scheduler required; Vercel native cron uses GET.
export const Route = createFileRoute('/api/public/hooks/sheets-sync')({
  server: {
    handlers: {
      POST: async ({ request }) => handleCandidateSyncCron(request, process.env.CRON_SECRET, {
        getIntegration: () => getSavedGoogleIntegration({ backfillLegacy: false }),
        runSync: () => runCandidateSync({ triggeredBy: 'cron' }),
        recordFailure: async () => {
          const { error } = await supabaseAdmin.from('sync_logs').insert({
            module: 'candidates', triggered_by: 'cron', status: 'error',
            message: 'Scheduled candidate sync failed',
            errors: [{ row: 0, message: 'Scheduled candidate sync failed' }],
          });
          if (error) console.error('Unable to persist scheduled sync failure');
        },
      }),
    },
  },
});
