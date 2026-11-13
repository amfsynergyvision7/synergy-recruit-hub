/**
 * Build84 server-only bounded remote download. This is NOT a general URL proxy.
 * Validates EVERY redirect destination before any new request. No credential,
 * private-network, HTTP, arbitrary host, or unbounded stream is permitted.
 */
export type DownloadPolicy = {
  allowedHost: (host: string) => boolean;
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
};
export type SafeDownload = { body: Buffer; contentType: string };
const MAX_REDIRECTS = 4;
const MAX_TIMEOUT_MS = 20000;
const MAX_BYTES = 10 * 1024 * 1024;
function safeDestination(candidate: string, policy: DownloadPolicy): URL {
  let url: URL;
  try { url = new URL(candidate); }
  catch { throw new Error("Remote file URL is invalid"); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password ||
      url.port !== "" || !policy.allowedHost(host) ||
      host === "localhost" || host.endsWith(".localhost") ||
      /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":")) {
    throw new Error("Remote file host is not approved");
  }
  return url;
}
export function isTrustedDriveHost(host: string): boolean {
  return host === "drive.google.com" ||
    host === "drive.usercontent.google.com" ||
    (host.endsWith(".googleusercontent.com") &&
     host.length > ".googleusercontent.com".length);
}
export function isTrustedSupabaseLogoUrl(raw: string | null, expectedBase: string | undefined): boolean {
  if (!raw || !expectedBase) return false;
  try {
    const base = new URL(expectedBase);
    const url = new URL(raw);
    return base.protocol === "https:" && url.protocol === "https:" &&
      base.hostname.endsWith(".supabase.co") && base.hostname !== "supabase.co" &&
      base.port === "" && url.port === "" &&
      url.origin === base.origin && !url.username && !url.password &&
      url.pathname.startsWith("/storage/v1/object/public/") &&
      url.pathname.length > "/storage/v1/object/public/".length &&
      !url.hash;
  } catch { return false; }
}
export async function downloadRemoteBounded(
  address: string, policy: DownloadPolicy,
  request: typeof fetch = fetch,
): Promise<SafeDownload> {
  if (!Number.isSafeInteger(policy.maxBytes) || policy.maxBytes <= 0 ||
      policy.maxBytes > MAX_BYTES || !Number.isSafeInteger(policy.timeoutMs) ||
      policy.timeoutMs < 100 || policy.timeoutMs > MAX_TIMEOUT_MS ||
      (policy.maxRedirects !== undefined &&
       (!Number.isSafeInteger(policy.maxRedirects) ||
        policy.maxRedirects < 0 || policy.maxRedirects > MAX_REDIRECTS))) {
    throw new Error("Remote download policy is invalid");
  }
  const redirects = policy.maxRedirects ?? MAX_REDIRECTS;
  let current = safeDestination(address, policy);
  for (let hop = 0; hop <= redirects; hop++) {
    const response = await request(current.toString(), {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(policy.timeoutMs),
      headers: { Accept: "application/pdf,application/octet-stream,image/png,image/jpeg,*/*" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (hop === redirects) {
        await response.body?.cancel().catch(() => {});
        throw new Error("Remote file redirected too many times");
      }
      const target = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!target) throw new Error("Remote file redirect is invalid");
      current = safeDestination(new URL(target, current).toString(), policy);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new Error("Remote file is unavailable");
    }
    const len = response.headers.get("content-length");
    if (len !== null && (!/^\d+$/.test(len) || Number(len) > policy.maxBytes)) {
      await response.body?.cancel().catch(() => {});
      throw new Error("Remote file is too large");
    }
    if (!response.body) throw new Error("Remote file has no body");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > policy.maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error("Remote file is too large");
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return { body: Buffer.concat(chunks.map(c => Buffer.from(c)), size),
      contentType: response.headers.get("content-type") ?? "" };
  }
  throw new Error("Remote file was not retrieved");
}

/**
 * Restrict untrusted provider JSON/text responses before decoding. This is
 * deliberately separate from downloadRemoteBounded: API responses may be
 * POST results and do not need the remote-asset URL policy.
 */
export async function readResponseTextBounded(response: Response, maxBytes = 512 * 1024): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 1024 * 1024) {
    throw new Error("Provider response size limit is invalid");
  }
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\\d+$/.test(length) || Number(length) > maxBytes)) {
    await response.body?.cancel().catch(() => {});
    throw new Error("Provider response exceeded safe size");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let count = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("Provider response exceeded safe size");
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(parts.map(part => Buffer.from(part)), count).toString("utf8");
}
