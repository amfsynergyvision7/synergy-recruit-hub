/**
 * Build 121 — OFFLINE ONLY, zero-network lead discovery from reviewed local
 * synthetic JSON-LD website snapshots. This tool cannot crawl, send email,
 * write a CRM record, or authorize any business prospect.
 *
 * Source boundaries follow the owner-controlled AMF Lead Research &
 * Outreach Guardrails (REVIEW DRAFT): public business facts, provenance,
 * no private contacts, no invented hiring signals, human review mandatory.
 */
import { readFile, realpath } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { isIP } from "node:net";

export const LIMITS = Object.freeze({
  sources: 12, htmlBytes: 250_000, scriptsPerSource: 25,
  entitiesPerSource: 200, leadName: 120, location: 90,
});
const MAX_MANIFEST_BYTES = 40_000;

function safeString(input, limit) {
  if (typeof input !== "string") return null;
  const value = input.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!value || value.length > limit || /[<>\u0000-\u001f\u007f]/u.test(value)) return null;
  return value;
}

export function syntheticHttpsUrl(input) {
  if (typeof input !== "string" || input.length > 500) return null;
  let parsed;
  try { parsed = new URL(input); } catch { return null; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.port || parsed.hash || isIP(parsed.hostname)) return null;
  const host = parsed.hostname.toLowerCase();
  // Reserved .invalid DNS name: no live company or person can be contacted.
  if (!host.endsWith(".example.invalid") || host.startsWith(".") ||
      host.includes("..") || host.split(".").some(s => !/^[a-z0-9-]+$/.test(s))) return null;
  return parsed;
}

export function normalizeCapturedDate(input) {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(input+"T00:00:00.000Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === input ? input : null;
}

function readBusinessEntities(html) {
  const entities=[];
  const scripts=html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu);
  let n=0;
  for (const match of scripts) {
    const attributes=match[1];
    if (!/\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)(?:\s|$)/iu.test(attributes)) continue;
    if (++n > LIMITS.scriptsPerSource) throw new Error("Too many structured-data scripts");
    let value;
    try { value=JSON.parse(match[2]); } catch { throw new Error("Invalid snapshot JSON-LD"); }
    const stack=[value];
    while (stack.length) {
      const entry=stack.pop();
      if (Array.isArray(entry)) { stack.push(...entry); continue; }
      if (!entry || typeof entry!=="object") continue;
      const type=entry["@type"],types=Array.isArray(type)?type:[type];
      if (types.includes("Organization") || types.includes("LocalBusiness") ||
          types.includes("Corporation")) entities.push(entry);
      if (entry["@graph"]) stack.push(entry["@graph"]);
      if (entities.length > LIMITS.entitiesPerSource) throw new Error("Too many structured-data entities");
    }
  }
  return entities;
}

export function discoverFromSnapshots(snapshots) {
  if (!Array.isArray(snapshots) || !snapshots.length ||
      snapshots.length > LIMITS.sources) throw new Error("Invalid source snapshot count");
  const byDomain=new Map();
  let discovered=0,duplicates=0,excluded=0;
  for (const source of snapshots) {
    const src=syntheticHttpsUrl(source?.source_url);
    const date=normalizeCapturedDate(source?.captured_on);
    if (!src || !date || typeof source.html!=="string" ||
        Buffer.byteLength(source.html,"utf8") > LIMITS.htmlBytes)
      throw new Error("Unapproved, unbounded or invalid source snapshot");
    const nodes=readBusinessEntities(source.html);
    for (const item of nodes) {
      const name=safeString(item.name,LIMITS.leadName);
      const site=syntheticHttpsUrl(item.url);
      if (!name || !site) { excluded++; continue; }
      const address=item.address && typeof item.address==="object" && !Array.isArray(item.address)
        ? item.address : {};
      const city=safeString(address.addressLocality,LIMITS.location);
      const industry=safeString(item.industry,LIMITS.location);
      if (!city || !industry) { excluded++; continue; }
      discovered++;
      const canonicalDomain=site.hostname.replace(/^www\./,"");
      const proof={source_url:src.href, captured_on:date, evidence_type:"JSON-LD Organization"};
      const previous=byDomain.get(canonicalDomain);
      if(previous) {
        duplicates++;
        if (!previous.evidence.some(x=>x.source_url===proof.source_url && x.captured_on===date))
          previous.evidence.push(proof);
        continue;
      }
      byDomain.set(canonicalDomain,{
        company_name:name, business_website:site.origin,
        location:city, industry, verified_hiring_signal:false,
        research_status:"synthetic_only_needs_human_review",
        outreach_authorized:false, crm_write_authorized:false,
        evidence:[proof]
      });
    }
  }
  const leads=[...byDomain.values()].sort((a,b)=>a.business_website.localeCompare(b.business_website));
  for (const lead of leads) lead.evidence.sort((a,b)=>a.source_url.localeCompare(b.source_url)||a.captured_on.localeCompare(b.captured_on));
  return {
    mode:"SYNTHETIC_OFFLINE_ONLY", network_requests:0, crm_writes:0, outbound_messages:0,
    source_count:snapshots.length, extracted_businesses:discovered,
    duplicates_merged:duplicates, excluded_incomplete:excluded,
    lead_count:leads.length, human_review_required:true, leads
  };
}

export async function runLocalManifest(manifestPath) {
  const file=resolve(manifestPath);
  const raw=await readFile(file);
  if (raw.byteLength>MAX_MANIFEST_BYTES) throw new Error("Manifest too large");
  let manifest;
  try { manifest=JSON.parse(raw.toString("utf8")); } catch { throw new Error("Manifest must be valid JSON"); }
  if (manifest?.mode!=="SYNTHETIC_OFFLINE_ONLY" ||
      !Array.isArray(manifest.sources) || !manifest.sources.length ||
      manifest.sources.length>LIMITS.sources) throw new Error("Only bounded synthetic offline discovery is supported");
  const base=await realpath(dirname(file));
  const snapshots=[];
  for(const source of manifest.sources) {
    const src=syntheticHttpsUrl(source?.source_url);
    const date=normalizeCapturedDate(source?.captured_on);
    const name=source?.snapshot;
    if (!src || !date || typeof name!=="string" || !name.endsWith(".html") ||
        isAbsolute(name) || name.includes("\\") || name.includes("\u0000"))
      throw new Error("Manifest has unapproved source metadata");
    const full=resolve(base,name),rel=relative(base,full);
    if (!rel || rel===".." || rel.startsWith("../") || isAbsolute(rel))
      throw new Error("Snapshot path escapes the local manifest directory");
    const real=await realpath(full),realRel=relative(base,real);
    if (!realRel || realRel===".." || realRel.startsWith("../") || isAbsolute(realRel))
      throw new Error("Snapshot symlink escapes the local manifest directory");
    const content=await readFile(real);
    if (content.byteLength>LIMITS.htmlBytes) throw new Error("Snapshot exceeds the size limit");
    snapshots.push({source_url:src.href,captured_on:date,html:content.toString("utf8")});
  }
  return discoverFromSnapshots(snapshots);
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length!==3) throw new Error("Usage: node discover.mjs <synthetic-manifest.json>");
    const report=await runLocalManifest(process.argv[2]);
    process.stdout.write(JSON.stringify(report,null,2)+"\n");
  } catch (error) {
    process.stderr.write("Offline discovery rejected input: "+error.message+"\n");
    process.exitCode=1;
  }
}
