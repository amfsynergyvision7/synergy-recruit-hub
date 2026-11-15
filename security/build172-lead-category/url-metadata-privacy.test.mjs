import test from "node:test";
import assert from "node:assert/strict";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {syntheticHttpsUrl,discoverFromSnapshots,runLocalManifest} from "../lead-discovery/discover.mjs";
import {buildReviewQueue} from "../lead-discovery/review.mjs";
const folder=join(dirname(fileURLToPath(import.meta.url)),"../lead-discovery");
const manifest=join(folder,"manifest.synthetic.json");
const clone=x=>JSON.parse(JSON.stringify(x));
test("Build172 fictional business origins and static source paths still work",async()=>{
 for(const url of ["https://acacia.example.invalid",
  "https://directory.example.invalid/logistics",
  "https://partners.example.invalid/listings",
  "https://fictional.example.invalid/a-b/fixture_01.html"]){
  assert(syntheticHttpsUrl(url),url);
 }
 const result=await runLocalManifest(manifest);
 assert.equal(result.mode,"SYNTHETIC_OFFLINE_ONLY");
 assert.equal(result.lead_count,3);
});
test("Build172 synthetic source refuses all query components, even empty delimiters",()=>{
 for(const url of [
  "https://directory.example.invalid/logistics?email=private@example.com",
  "https://directory.example.invalid/logistics?access_token=secret",
  "https://directory.example.invalid/logistics?next=https%3A%2F%2Freal.example.com",
  "https://directory.example.invalid/logistics?",
  "https://directory.example.invalid/?",
  "https://directory.example.invalid/#token"
 ])assert.equal(syntheticHttpsUrl(url),null,url);
});
test("Build172 rejects encoded or contact-bearing URL path segments",()=>{
 for(const url of [
  "https://directory.example.invalid/%40private",
  "https://directory.example.invalid/person%40private.example",
  "https://directory.example.invalid/a%2Fb",
  "https://directory.example.invalid/a%3Ftoken",
  "https://directory.example.invalid/alice@example.com",
  "https://directory.example.invalid/नमस्ते"
 ])assert.equal(syntheticHttpsUrl(url),null,url);
});
test("Build172 synthetic URLs reject noncanonical hostnames and credentials",()=>{
 for(const url of [
  "https://-malformed.example.invalid/a",
  "https://malformed-.example.invalid/a",
  "https://xn--mycompany.example.invalid/a",
  "https://user:secret@directory.example.invalid/logistics",
  "https://directory.example.invalid:8080/logistics",
  "https://directory.example.invalid/a//b",
  "https://real-company.com",
  "https://192.168.1.1",
 ])assert.equal(syntheticHttpsUrl(url),null,url);
});
test("Build172 source normalization rejects tainted source even if HTML is benign",()=>{
 for(const bad of [
  "https://directory.example.invalid/logistics?email=secret@example.org",
  "https://directory.example.invalid/%40private"
 ])assert.throws(()=>discoverFromSnapshots([
   {source_url:bad,captured_on:"2026-11-12",html:"<html></html>"}
  ]),/Unapproved, unbounded or invalid source snapshot/,bad);
});
test("Build172 review queue never lets a tainted source URL become a provenance record",async()=>{
 const clean=await runLocalManifest(manifest);
 for(const bad of [
  "https://directory.example.invalid/logistics?token=secret",
  "https://directory.example.invalid/%40private"
 ]){
  const edited=clone(clean);
  edited.leads[0].evidence[0].source_url=bad;
  assert.throws(()=>buildReviewQueue(edited),/Invalid synthetic lead provenance/,bad);
 }
});
test("Build172 no network or CRM use is added by strict provenance parsing",()=>{
 const implementation=syntheticHttpsUrl.toString();
 for(const pattern of ["fetch(","https.request","http.request","sendEmail(","createClient("])
  assert(!implementation.includes(pattern),pattern);
});
