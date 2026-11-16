/**
 * Browser-only image upload integrity for the CRM branding form.
 * This does not replace server-side storage authorization or scanning.
 */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function verifyLogoSignature(
  claimedType: string,
  size: number,
  bytes: Uint8Array,
): string | null {
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_LOGO_BYTES)
    return "Logo must be a non-empty image no larger than 2MB.";
  if (!ACCEPTED_LOGO_TYPES.some(type => type === claimedType))
    return "Upload a PNG, JPG or WEBP image only; SVG and other formats are not supported.";
  if (!(bytes instanceof Uint8Array)) return "Unable to verify image contents.";
  const starts = (sig: readonly number[]) =>
    bytes.length >= sig.length &&
    sig.every((byte, offset) => bytes[offset] === byte);
  const isPng = starts([137, 80, 78, 71, 13, 10, 26, 10]);
  const isJpeg = starts([255, 216, 255]);
  const isWebp = starts([82, 73, 70, 70]) &&
    bytes.length >= 12 &&
    startsAt(bytes, 8, [87, 69, 66, 80]);
  if (!((claimedType === "image/png" && isPng) ||
        (claimedType === "image/jpeg" && isJpeg) ||
        (claimedType === "image/webp" && isWebp)))
    return "The file contents do not match the selected raster image format.";
  return null;
}

function startsAt(bytes: Uint8Array, offset: number, sig: readonly number[]) {
  return bytes.length >= offset + sig.length &&
    sig.every((byte, index) => bytes[offset + index] === byte);
}
