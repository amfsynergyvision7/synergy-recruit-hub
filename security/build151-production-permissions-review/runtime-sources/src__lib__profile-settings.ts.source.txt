import { supabase } from "@/integrations/supabase/client";

// The review branch does not enable the restricted self-profile RPC until
// the database migration and genuine hosted user acceptance are approved.
// Draft release hold is unconditional: a public browser build variable
// cannot independently activate a not-yet-approved hosted profile RPC.
export const CRM_PROFILE_MUTATIONS_ENABLED = false as const;

type ProfileRpcError = { message: string } | null;
type ProfileRpcClient = {
  rpc(name: "crm_update_own_profile", args: {
    p_full_name: string; p_phone: string | null; p_department: string | null;
  }): Promise<{ data: unknown; error: ProfileRpcError }>;
};
const rpc = supabase as unknown as ProfileRpcClient;

export async function updateOwnCRMProfile(input: {
  full_name: string; phone: string | null; department: string | null;
}): Promise<{ error: ProfileRpcError }> {
  if (!CRM_PROFILE_MUTATIONS_ENABLED) {
    return { error: { message: "Profile edits are paused pending security release" } };
  }
  const name = input.full_name.trim();
  if (name.length < 1 || name.length > 120
     || (input.phone?.length ?? 0) > 32
     || (input.department?.length ?? 0) > 120) {
    return { error: { message: "Invalid profile fields" } };
  }
  // Profile ID comes only from the signed Supabase session inside the RPC.
  // The browser cannot mutate status, is_active or user_roles via this call.
  const { error } = await rpc.rpc("crm_update_own_profile", {
    p_full_name: name,
    p_phone: input.phone?.trim() || null,
    p_department: input.department?.trim() || null,
  });
  return { error };
}
