import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  CRM_LEGACY_OUTBOUND_EMAIL_RELEASE_HOLD,
  assertCrmLegacyOutboundEmailReleased,
} from "../src/lib/legacy-outbound-email-release-hold.server.ts";
const read = name => readFileSync(new URL("../"+name, import.meta.url),"utf8");
const sendRoute = read("src/lib/email.functions.ts");
const provider = read("src/lib/email.server.ts");
test("Legacy CRM outbound remains immutable and fails closed without environment override",()=>{
  assert.equal(CRM_LEGACY_OUTBOUND_EMAIL_RELEASE_HOLD,true);
  assert.throws(()=>assertCrmLegacyOutboundEmailReleased(),/paused pending independent security/);
  const source=read("src/lib/legacy-outbound-email-release-hold.server.ts");
  assert.doesNotMatch(source,/process\\.env|import\\.meta\\.env|localStorage|sessionStorage/);
});
test("Server route checks hard hold before role lookup, SMTP, and correspondence insert",()=>{
  const source=sendRoute.slice(sendRoute.indexOf("export const sendCrmEmail"),sendRoute.indexOf("export const listEmailHistory"));
  const hold=source.indexOf("assertCrmLegacyOutboundEmailReleased();");
  assert.ok(hold>=0);
  for(const item of ['.from("user_roles")','sendEmail({','.from("email_log"']) {
    assert.ok(source.indexOf(item)>hold,item);
  }
});
test("SMTP provider itself blocks before credentials, sender construction and sendMail",()=>{
  const source=provider.slice(provider.indexOf("export async function sendEmail"),provider.indexOf("export function textToHtml"));
  const held=source.indexOf("assertCrmLegacyOutboundEmailReleased();");
  assert.ok(held>=0);
  assert.ok(held<source.indexOf("process.env.SMTP_USER"));
  assert.ok(held<source.indexOf(".sendMail({"));
});
