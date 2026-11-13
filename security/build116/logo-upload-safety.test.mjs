import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACCEPTED_LOGO_TYPES, MAX_LOGO_BYTES, verifyLogoSignature } from "../../src/lib/logo-upload-safety.ts";

const settings = readFileSync(new URL("../../src/routes/_app.settings.tsx", import.meta.url), "utf8");
const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]);
const jpeg = Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,0,0,0,0,0]);
const webp = Uint8Array.from([82,73,70,70,52,0,0,0,87,69,66,80,0,0,0,0]);

test("Build116 accepts PNG, JPEG and WebP matching exact MIME and header bytes", () => {
  assert.deepEqual(ACCEPTED_LOGO_TYPES, ["image/png", "image/jpeg", "image/webp"]);
  for (const [type, bytes] of [["image/png", png], ["image/jpeg", jpeg], ["image/webp", webp]]) {
    assert.equal(verifyLogoSignature(type, 200, bytes), null);
    assert.equal(verifyLogoSignature(type, MAX_LOGO_BYTES, bytes), null);
  }
});

test("Build116 rejects SVG, executable content, MIME spoofing and oversized/empty files", () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  for (const [type, bytes] of [
    ["image/svg+xml", svg], ["image/png", svg], ["image/png", jpeg],
    ["image/jpeg", png], ["image/webp", jpeg], ["image/gif", png],
    ["application/octet-stream", png],
  ]) assert.match(verifyLogoSignature(type, 100, bytes), /image|format|PNG/i);
  assert.match(verifyLogoSignature("image/png", 0, png), /non-empty/);
  assert.match(verifyLogoSignature("image/png", MAX_LOGO_BYTES + 1, png), /2MB/);
  assert.match(verifyLogoSignature("image/png", -1, png), /non-empty/);
  assert.match(verifyLogoSignature("image/png", 50, new Uint8Array()), /file contents/i);
});

test("Build116 branding upload validates byte signature before storage writes", () => {
  const start = settings.indexOf("const uploadLogo = async (file: File)");
  const end = settings.indexOf("const setOrgDefaultTheme", start);
  const uploader = settings.slice(start, end);
  assert(start > 0 && end > start);
  assert(uploader.indexOf("file.slice(0, 16).arrayBuffer()") > 0);
  assert(uploader.indexOf("verifyLogoSignature(file.type, file.size, signature)") > 0);
  assert(uploader.indexOf("verifyLogoSignature(") < uploader.indexOf('.from("branding")'));
  assert(!uploader.includes('"image/svg+xml"'));
  assert(settings.includes("SVG not accepted"));
  assert(settings.includes("accept={ACCEPTED_LOGO_TYPES.join"));
});
