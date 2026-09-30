// Server-only SMTP email sending. Provider-agnostic by design — this file
// has now been Resend's REST API, then Zoho SMTP, then Gmail SMTP, and is
// now back to Resend, this time over its SMTP relay instead of its REST API
// — so nothing provider-specific lives in the code; only environment
// variable VALUES change on Vercel. That churn is exactly why this file is
// written the way it is: switching again later needs no further edits here.
//
// SMTP_USER / SMTP_PASSWORD (the connection's AUTH credentials) must be set
// as server environment variables (Vercel project settings, same place
// SUPABASE_URL / GEMINI_API_KEY already live); they're never read or
// referenced from client-side code, so they can't end up in the browser
// bundle. SMTP_FROM_EMAIL is a SEPARATE setting for the address recipients
// actually see mail arrive from — for a real mailbox (Gmail, Zoho) the auth
// user and the from address are the same thing and SMTP_FROM_EMAIL can be
// left unset (it defaults to SMTP_USER below); for Resend's SMTP relay
// they're different (the auth username is the literal string "resend", not
// an email address), so SMTP_FROM_EMAIL is required there.
//
// Current provider: Resend, via SMTP rather than its REST API — chosen
// specifically for deliverability: a verified domain gets you real SPF/DKIM
// alignment for that domain, which a personal Gmail or Zoho mailbox cannot
// offer for a company name, and is why Gmail-sent mail from this CRM was
// landing in spam. Two things only you can do, since they require your own
// domain/account:
//   1. Sign up at https://resend.com, go to Domains → Add Domain, and
//      verify amfsynergyvision.com (or a subdomain like mail.
//      amfsynergyvision.com) by adding the DNS records Resend gives you.
//      Until verified, Resend only delivers to your own Resend account
//      email — fine for one personal test, not for real candidates/clients.
//      Then go to API Keys → Create API Key and copy it.
//   2. Set these on Vercel and redeploy:
//        SMTP_HOST      = smtp.resend.com
//        SMTP_PORT      = 465
//        SMTP_USER      = resend            (literally this word, not your email)
//        SMTP_PASSWORD  = <the API key from step 1>
//        SMTP_FROM_EMAIL = no-reply@amfsynergyvision.com   (must be on the verified domain)
//      Optional: SMTP_FROM_NAME controls the display name recipients see
//      (defaults to "AMF Synergy Vision" below).
//
// Switching to a DIFFERENT provider later: change the values above (a real
// mailbox's own SMTP host/port, its address as both SMTP_USER and — by
// leaving SMTP_FROM_EMAIL unset — its from address too) — nothing in this
// file needs to change.
import nodemailer from "nodemailer";

export interface SendEmailResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

// Cached across invocations on a warm serverless instance, same lazy-
// singleton pattern as supabaseAdmin in client.server.ts — avoids
// re-authenticating a fresh SMTP connection on every single send within the
// same warm container.
let _transporter: ReturnType<typeof nodemailer.createTransport> | undefined;
let _transporterKey: string | undefined;

function getTransporter(user: string, pass: string) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  // Keyed on the settings that actually affect the connection, so changing
  // an env var (e.g. testing a different account) without redeploying the
  // whole function still picks up fresh config instead of reusing a stale
  // cached transporter from before the change.
  const key = `${host}:${port}:${secure}:${user}`;
  if (_transporter && _transporterKey === key) return _transporter;
  _transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  _transporterKey = key;
  return _transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  // .trim() on every value read here: a stray trailing space or line break
  // (easy to introduce when copy-pasting into Vercel's env var UI) is
  // invisible in the dashboard but turns an otherwise-correct address into
  // something the SMTP server's strict parser rejects.
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  if (!user || !pass) {
    const missing = [!user && "SMTP_USER", !pass && "SMTP_PASSWORD"].filter(Boolean).join(", ");
    return { success: false, error: `${missing} not configured. Add it as an environment variable and redeploy.` };
  }
  // Falls back to SMTP_USER for a real-mailbox provider (Gmail, Zoho) where
  // the authenticated address IS the from address. Resend's SMTP relay
  // needs SMTP_FROM_EMAIL set explicitly, since its auth username
  // ("resend") isn't a mailbox at all — if SMTP_FROM_EMAIL isn't actually
  // reaching this function (unset, a typo'd key name on Vercel, or a
  // deploy that predates adding it), this would otherwise silently fall
  // back to sending as "resend", which the SMTP server rejects at the
  // envelope stage with a "Bad sender address syntax" error. Caught
  // explicitly below instead, with a message that names the real cause.
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim() || user;
  const fromName = (process.env.SMTP_FROM_NAME || "AMF Synergy Vision").trim();

  if (!fromEmail.includes("@")) {
    return {
      success: false,
      error: `SMTP_FROM_EMAIL is missing or invalid (it currently resolves to "${fromEmail}", which isn't a real email address). Set SMTP_FROM_EMAIL on Vercel to a real address on your verified domain (e.g. yourname@amfsynergyvision.com) and redeploy.`,
    };
  }

  try {
    const info = await getTransporter(user, pass).sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { success: true, providerId: info.messageId };
  } catch (err: any) {
    // A bad/expired credential, a from address not on a verified domain, or
    // a sending cap all surface here as a thrown error from nodemailer
    // rather than an HTTP status — message text is whatever the SMTP server
    // replied with, which is usually specific enough to act on directly.
    return { success: false, error: err?.message ?? "SMTP send failed for an unknown reason." };
  }
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