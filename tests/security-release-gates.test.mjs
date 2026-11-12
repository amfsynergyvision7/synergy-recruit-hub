import test from "node:test";
import assert from "node:assert/strict";
import {
  assertExternalAiApproved,
  assertSmtpApproved,
  assertMatchingSupabaseProject,
  isExplicitlyApproved,
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

test("SEC-01 rejects production host in isolation and lookalike hostnames", () => {
  const isolated = "dhlhlasnaapzckjyvffn";
  for (const url of [
    "https://wusntntcqgtpgokggdzv.supabase.co",
    `https://evil-${isolated}.supabase.co`,
    `https://${isolated}.supabase.co.evil.example`,
    undefined,
  ]) assert.throws(() => assertMatchingSupabaseProject(url, isolated), /SEC-01/);
});

test("SEC-11 and SEC-12 require literal string approval", () => {
  for (const value of [null, true, 1, "True", "yes", "on", " true", "true\\n"]) {
    assert.equal(isExplicitlyApproved(value), false);
    assert.throws(() => assertExternalAiApproved(value), /SEC-12/);
    assert.throws(() => assertSmtpApproved(value), /SEC-11/);
  }
  assert.equal(isExplicitlyApproved("true"), true);
});

test("SEC-01 rejects noncanonical Supabase URLs even with the correct hostname", () => {
  const project = "dhlhlasnaapzckjyvffn";
  assert.doesNotThrow(() => assertMatchingSupabaseProject(`https://${project}.supabase.co/`, project));
  for (const url of [
    `http://${project}.supabase.co`,
    `https://user:pass@${project}.supabase.co`,
    `https://${project}.supabase.co:8443`,
    `https://${project}.supabase.co/rest/v1`,
    `https://${project}.supabase.co/?redirect=evil`,
    `https://${project}.supabase.co/#fragment`,
  ]) assert.throws(() => assertMatchingSupabaseProject(url, project), /SEC-01/);
});
