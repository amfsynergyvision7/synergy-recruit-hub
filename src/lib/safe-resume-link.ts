/**
 * Stored candidate resume URLs may predate present import validation.
 * Never embed a legacy untrusted URL in a clickable React href without
 * validating the scheme and destination. This does not fetch any resume.
 */
export function safeResumeHref(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0 ||
      input.length > 4096 || input.trim() !== input ||
      /[\u0000-\u0020\u007f]/.test(input)) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname ||
      url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // Only public DNS names, never local/intranet or IP-literal endpoints.
  if (!host.includes(".") || /[:[\]]/.test(host) ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) ||
      host === "localhost" ||
      /\.(?:localhost|local|internal|test|invalid)$/.test(host))
    return null;
  return url.href;
}
