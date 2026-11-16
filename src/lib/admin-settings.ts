import { supabase } from "@/integrations/supabase/client";
import { CRM_ORG_SETTINGS_MUTATIONS_PAUSED, CRM_ORG_SETTINGS_HOLD_REASON } from "@/lib/release-safety";

export type AdminSettingKey = "logo_url" | "default_color_theme" | "resume_import_folder_url";
type RpcError = { message: string } | null;

/** The RPCs must exist before enabling the restricted app_settings grants. */
type AdminSettingsRpc = {
  rpc(
    name: "crm_admin_get_resume_folder" | "crm_admin_update_setting",
    args?: Record<string, string | null>,
  ): Promise<{ data: unknown; error: RpcError }>;
};

const rpcClient = supabase as unknown as AdminSettingsRpc;

export async function getAdminResumeFolder(): Promise<{ data: string | null; error: RpcError }> {
  const { data, error } = await rpcClient.rpc("crm_admin_get_resume_folder");
  return { data: typeof data === "string" ? data : null, error };
}

export async function updateAdminSetting(
  key: AdminSettingKey, value: string | null,
): Promise<{ error: RpcError }> {
  if (CRM_ORG_SETTINGS_MUTATIONS_PAUSED)
    return { error: { message: CRM_ORG_SETTINGS_HOLD_REASON } };
  const { error } = await rpcClient.rpc("crm_admin_update_setting", { p_key: key, p_value: value });
  return { error };
}
