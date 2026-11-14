import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED,
  CRM_EMAIL_COMPOSER_HOLD_REASON,
  assertCrmEmailSendAllowed,
} from "../../src/lib/release-safety.ts";

const file = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const composer = file("src/components/EmailComposeDialog.tsx");
const server = file("src/lib/email.functions.ts");
const effect = file("src/lib/external-effects-hold.server.ts");

test("Build118 client and server email release holds remain unconditional", () => {
  assert.equal(CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED, true);
  assert.match(CRM_EMAIL_COMPOSER_HOLD_REASON, /paused/);
  assert.throws(assertCrmEmailSendAllowed, /paused/);
  const send = server.slice(server.indexOf("export const sendCrmEmail"),server.indexOf("export const listEmailHistory"));
  assert(send.indexOf('assertExternalEffectReleased("crm_email")') >= 0);
  assert(send.indexOf('assertExternalEffectReleased("crm_email")') < send.indexOf("sendEmail({"));
  assert.match(effect,/export const CRM_OUTBOUND_EMAIL_RELEASE_HOLD = true as const;/);
});

test("Build118 removes unapproved placement fees and commitments from default templates", () => {
  for (const claim of [
    "selection_confirmation", "Placement Service Fee", "25%",
    "45 days", "7 days", "I Acknowledge", "senior leadership",
    "Senior HR Associate", "You've Been Selected", "Congratulations!",
  ]) assert(!composer.includes(claim), claim);
  assert(composer.includes('key: "neutral_follow_up"'));
  assert(composer.includes('label: "Neutral follow-up (draft only)"'));
  assert(composer.includes("No email is sent from this screen."));
});

test("Build118 browser blocks email sending before calling server RPC", () => {
  const mutation = composer.slice(composer.indexOf("const sendMut = useMutation"),composer.indexOf("const runHistory = "));
  assert(mutation.indexOf("assertCrmEmailSendAllowed();") >= 0);
  assert(mutation.indexOf("assertCrmEmailSendAllowed();") < mutation.indexOf("return runSend({"));
  assert(composer.includes("disabled={CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED || sendMut.isPending"));
  assert(composer.includes("if (CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED) return;"));
  assert(composer.includes("Sending paused"));
});

test("Build118 correspondence query cache is scoped to current user and exact record", () => {
  assert(composer.includes('queryKey: ["email-merge-context", user?.id ?? "signed-out", relatedTable, relatedId]'));
  assert(composer.includes('queryKey: ["email-history", user?.id ?? "signed-out", relatedTable, relatedId]'));
  assert.equal((composer.match(/enabled: open && !!user\?\.id && !CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED/g)||[]).length,2);
  assert(composer.includes("}, [open, relatedTable, relatedId, toEmail]);"));
});

test("Build118 no environment bypass or raw provider error disclosure", () => {
  const safety = file("src/lib/release-safety.ts");
  assert(!/process\.env|import\.meta\.env|localStorage/.test(safety));
  assert(composer.includes('onError: () => toast.error(CRM_EMAIL_COMPOSER_HOLD_REASON)'));
  assert(!composer.includes("err?.message ??"));
  assert(!composer.includes("Sends from your CRM's configured address"));
});
