import { supabase } from "@/integrations/supabase/client";

// The review branch cannot enable these consequential account changes merely
// because an admin is logged in. The database RPC must also be installed,
// independently reviewed and tested against genuine hosted Auth sessions.
export const CRM_USER_ADMIN_MUTATIONS_ENABLED =
  import.meta.env.VITE_CRM_USER_ADMIN_MUTATIONS_ENABLED === "true";

export type AdminUserMutation =
  | { targetId: string; operation: "set_status"; value: "pending" | "approved" | "rejected" | "suspended" }
  | { targetId: string; operation: "set_active"; value: "true" | "false" }
  | { targetId: string; operation: "set_role"; value: "admin" | "recruiter" | "operations" | "finance" | "viewer" };

type AdminRpcError = { message: string } | null;
type AdminRpcClient = {
  rpc(
    name: "crm_admin_manage_user",
    args: { p_target: string; p_operation: AdminUserMutation["operation"]; p_value: string },
  ): Promise<{ data: unknown; error: AdminRpcError }>;
};

const rpc = supabase as unknown as AdminRpcClient;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function manageCRMUser(change: AdminUserMutation): Promise<{ error: AdminRpcError }> {
  if (!CRM_USER_ADMIN_MUTATIONS_ENABLED) {
    return { error: { message: "User administration is paused pending release approval" } };
  }
  if (!UUID.test(change.targetId)) {
    return { error: { message: "Invalid user identifier" } };
  }
  // Never perform browser-side profile or role table mutations. This call
  // forwards a signed JWT to the authenticated-only SQL SECURITY DEFINER RPC.
  // SQL derives the acting user ONLY from auth.uid(), validates active admin
  // role, serializes updates, blocks self lockout and atomically audits changes.
  const { error } = await rpc.rpc("crm_admin_manage_user", {
    p_target: change.targetId,
    p_operation: change.operation,
    p_value: change.value,
  });
  return { error };
}
