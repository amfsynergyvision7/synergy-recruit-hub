// Pure, dependency-free release gates shared by server modules and Node tests.
export function isExplicitlyApproved(value) {
  return value === "true";
}

export function assertExternalAiApproved(value) {
  if (!isExplicitlyApproved(value)) {
    throw new Error("SEC-12: external AI processing is disabled pending privacy and processor approval.");
  }
}

export function assertSmtpApproved(value) {
  if (!isExplicitlyApproved(value)) {
    throw new Error("SEC-11: SMTP delivery is disabled until durable outbox verification.");
  }
}

export function assertMatchingSupabaseProject(url, projectId) {
  if (!projectId || !url) throw new Error("SEC-01: missing Supabase project configuration.");
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("SEC-01: invalid Supabase URL."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port ||
      parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("SEC-01: unsafe Supabase URL configuration.");
  }
  if (parsed.hostname !== `${projectId}.supabase.co`) throw new Error("SEC-01: Supabase project mismatch.");
}
