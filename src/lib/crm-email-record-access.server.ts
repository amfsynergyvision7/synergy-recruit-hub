/**
 * Build86 — server-only per-record read gate for email history/template context.
 * Protects sensitive candidate correspondence even if future RLS is broad.
 * No admin/service-role client here; reads use caller's signed Supabase client.
 */
import { assertApprovedRole } from "./access-gates.server";
import {
  isCrmEmailRecordReadable,
  type CrmEmailRole,
  type CrmEmailTable,
} from "./crm-email-recipient-policy";

export async function assertCrmEmailRecordReadAccess(args: {
  supabase: any;
  actorId: string;
  relatedTable: CrmEmailTable;
  relatedId: string;
}): Promise<void> {
  const { supabase, actorId, relatedTable, relatedId } = args;
  // Verify signed identity and uniquely assigned approved/active role.
  await assertApprovedRole(actorId, ["admin", "recruiter"]);
  const { data: memberships, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", actorId);
  if (roleError || !Array.isArray(memberships) || memberships.length !== 1) {
    throw new Error("Email record access denied");
  }
  const role: unknown = memberships[0]?.role;
  if (role !== "admin" && role !== "recruiter") {
    throw new Error("Email record access denied");
  }
  const approvedRole: CrmEmailRole = role;
  if (relatedTable === "clients" && approvedRole !== "admin") {
    throw new Error("Email record access denied");
  }
  if (relatedTable === "candidates") {
    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("assigned_recruiter")
      .eq("id", relatedId)
      .maybeSingle();
    if (error || !isCrmEmailRecordReadable({
      relatedTable,
      record: candidate,
      actingUserId: actorId,
      approvedRole,
    })) throw new Error("Email record access denied");
    return;
  }
  if (relatedTable === "clients") {
    const { data: client, error } = await supabase
      .from("clients")
      .select("id")
      .eq("id", relatedId)
      .maybeSingle();
    if (error || !isCrmEmailRecordReadable({
      relatedTable,
      record: client,
      actingUserId: actorId,
      approvedRole,
    })) throw new Error("Email record access denied");
    return;
  }
  throw new Error("Email record access denied");
}
