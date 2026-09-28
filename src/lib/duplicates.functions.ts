import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findDuplicateClusters } from "./duplicates.server";

// Read-only scan across the whole candidate table — no extra role gate
// beyond "signed in" (same as AI Match), since this only reads data anyone
// who can see the Candidates page can already see. The actual delete a
// reviewer performs afterwards goes straight through the normal Supabase
// client from the browser, same as every other delete in this app, so it's
// already blocked for non-admins by the candidates table's DELETE RLS
// policy regardless of what this page displays.
export const scanForDuplicateCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return findDuplicateClusters(context.supabase);
  });