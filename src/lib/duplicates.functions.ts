import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findDuplicateClusters } from "./duplicates.server";
import { assertApprovedRole } from "./access-gates.server";

// Duplicate review potentially exposes contact data across the entire CRM.
// A signed-in session alone does not authorize cross-candidate scanning.
// Require a unique active approved administrator before querying any rows.
export const scanForDuplicateCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Duplicate review returns contact details for up to 5,000 candidates.
    // Only an approved, active, uniquely assigned admin can scan this scope.
    await assertApprovedRole(context.userId, ["admin"]);
    return findDuplicateClusters(context.supabase, context.userId);
  });