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
  let host;
  try { host = new URL(url).hostname; } catch { throw new Error("SEC-01: invalid Supabase URL."); }
  if (host !== `${projectId}.supabase.co`) throw new Error("SEC-01: Supabase project mismatch.");
}
