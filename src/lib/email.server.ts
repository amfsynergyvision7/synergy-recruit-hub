// Server-only Resend API access. RESEND_API_KEY must be set as a server
// environment variable (Vercel project settings, same place SUPABASE_URL /
// GEMINI_API_KEY / DRIVE_API_KEY already live) — it is never read or
// referenced from client-side code, so it can't end up in the browser bundle.
//
// Resend was picked over SendGrid/Postmark for the same reason Gemini was
// picked for AI: a real free tier (3,000 emails/month, 100/day, no credit
// card) that fits this project's Supabase-free-tier prototype phase, and a
// plain REST endpoint simple enough not to need an SDK dependency.
//
// Two things only you can do, since they require your own domain/account:
//   1. Sign up at https://resend.com, verify a sending domain (your own
//      amfsynergyvision.com, or a subdomain of it) under Domains, and create
//      an API key under API Keys.
//   2. Set RESEND_API_KEY and RESEND_FROM_EMAIL ("AMF Synergy Vision
//      <no-reply@yourdomain.com>") as environment variables on Vercel and
//      redeploy. Until a domain is verified, Resend only lets you send to
//      your own account email — fine for testing, not for real candidates.
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

export async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    const missing = [!apiKey && "RESEND_API_KEY", !from && "RESEND_FROM_EMAIL"].filter(Boolean).join(", ");
    return { success: false, error: `${missing} not configured. Add it as an environment variable and redeploy.` };
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    // Resend's error body is usually { statusCode, name, message } — fall
    // back to the raw text so a shape change still surfaces something useful
    // instead of a dead-end "[object Object]".
    const message = typeof data === "object" && data?.message ? data.message : (typeof data === "string" ? data : JSON.stringify(data));
    return { success: false, error: `Resend API ${res.status}: ${message}` };
  }
  return { success: true, providerId: typeof data === "object" ? data?.id : undefined };
}

// Plain body text -> minimal HTML email. Recruiters type plain text in the
// compose box; this just preserves line breaks and escapes anything that
// would otherwise be read as markup.
export function textToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escaped}</div>`;
}