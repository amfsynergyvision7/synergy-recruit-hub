import test from "node:test";
import assert from "node:assert/strict";
import {
  assertExternalAiApproved,
  assertSmtpApproved,
  assertMatchingSupabaseProject,
} from "../src/lib/security/release-gates.mjs";

test("SEC-12 AI processing is disabled by default and with ambiguous values", () => {
  for (const value of [undefined, "", "TRUE", "1", "false", "true "]) {
    assert.throws(() => assertExternalAiApproved(value), /disabled/);
  }
  assert.doesNotThrow(() => assertExternalAiApproved("true"));
});

test("SEC-11 SMTP delivery is disabled by default and with ambiguous values", () => {
  for (const value of [undefined, "", "TRUE", "1", "false", "true "]) {
    assert.throws(() => assertSmtpApproved(value), /disabled/);
  }
  assert.doesNotThrow(() => assertSmtpApproved("true"));
});

test("SEC-01 rejects wrong, malformed and deceptive Supabase hosts", () => {
  const project = "dhlhlasnaapzckjyvffn";
  assert.doesNotThrow(() => assertMatchingSupabaseProject(`https://${project}.supabase.co`, project));
  for (const url of [
    "https://another.supabase.co",
    `https://${project}.supabase.co.evil.example`,
    "invalid",
    "",
  ]) assert.throws(() => assertMatchingSupabaseProject(url, project));
  assert.throws(() => assertMatchingSupabaseProject(`https://${project}.supabase.co`, undefined));
});
