import type { SupabaseClient } from "@supabase/supabase-js";

/** SEC-12: fail closed before invoking any resume, AI, PDF, or Drive operation.
 * Uses the caller's JWT-bound Supabase client, never a service-role client.
 * Existing table RLS must independently enforce row/team ownership.
 */
export async function requireCrmRecordAccess(
  supabase: SupabaseClient<any>,
  userId: string,
  table: "candidates" | "job_openings" | "clients",
  recordId: string,
): Promise<void> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("id").eq("id", userId).maybeSingle();
  if (profileError || !profile) throw new Error("Access denied: active profile required.");

  const { data: roles, error: roleError } = await supabase
    .from("user_roles").select("role").eq("user_id", userId);
  if (roleError || !roles?.some((r: {role: string}) => r.role === "admin" || r.role === "recruiter")) {
    throw new Error("Access denied: approved CRM role required.");
  }

  const { data: record, error: recordError } = await supabase
    .from(table).select("id").eq("id", recordId).maybeSingle();
  if (recordError || !record) throw new Error("Access denied: record not accessible.");
}
