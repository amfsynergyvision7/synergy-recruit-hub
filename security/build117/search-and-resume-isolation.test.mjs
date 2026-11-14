import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeGlobalSearchTerm, buildSafeGlobalSearchOr } from "../../src/lib/safe-global-search.ts";

const file = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const search = file("src/components/GlobalSearch.tsx");
const resume = file("src/components/ResumeSummaryButton.tsx");

test("Build117 bounded names, phone and email fragments accepted", () => {
  for (const value of ["Anil Kumar", "O'Brien", "recruiter@example.com",
    "+91 90000", "John-Smith", "Café Résumé", "Team A."])
    assert.equal(safeGlobalSearchTerm("  " + value + " "), value);
  assert.equal(safeGlobalSearchTerm("a"), null);
  assert.equal(safeGlobalSearchTerm("x".repeat(81)), null);
});

test("Build117 filter injection, wildcards, controls and oversized searches are rejected", () => {
  for (const bad of [
    "a,b", "a)or(id.eq.anything", "a:b", "a(b", "a)b",
    "a%a", "a_a", "a*a", "a\\\\b", 'a"b',
    "a\nb", "a\tb", "a/b", "x".repeat(10000),
  ]) assert.equal(safeGlobalSearchTerm(bad), null, bad);
  assert.equal(safeGlobalSearchTerm(undefined), null);
  assert.equal(safeGlobalSearchTerm(null), null);
});

test("Build117 PostgREST OR queries quote values and fix column allowlists", () => {
  const scopes = {
    candidates: ["full_name", "candidate_code", "email", "mobile"],
    clients: ["company_name", "contact_person"],
    jobs: ["job_title", "location"],
  };
  for (const [scope, columns] of Object.entries(scopes)) {
    for (const term of ["O'Brien", "acme.com", "Anil Kumar"]) {
      const clauses = buildSafeGlobalSearchOr(term, scope).split(",");
      assert.deepEqual(clauses, columns.map(col => col + '.ilike."%' + term + '%"'));
    }
  }
  for (const [term, scope] of [
    ["a,b", "candidates"], ["a)b", "clients"], ["valid", "unknown"],
  ]) assert.throws(() => buildSafeGlobalSearchOr(term, scope), /not safe/);
});

test("Build117 closing/changing query aborts all three private table searches", () => {
  assert(search.includes("new AbortController()"));
  assert.equal((search.match(/\.abortSignal\(controller\.signal\)/g) || []).length, 3);
  assert(search.includes("controller.abort();"));
  assert(search.includes("clearTimeout(timer);"));
  assert(search.includes("if (!active) return;"));
  assert(search.includes("if (active) setLoading(false);"));
  assert(search.includes("}, [query, open]);"));
});

test("Build117 old account/query search data never renders in a new query", () => {
  assert(search.includes("snapshot?.term === term"));
  assert(search.includes("snapshot.results : EMPTY_RESULTS"));
  assert(search.includes("Search is temporarily unavailable."));
  assert(search.includes("if (candidatesRes.error || clientsRes.error || jobsRes.error)"));
  assert(search.includes("invalidQuery ?"));
  assert(!search.includes("const like = "));
});

test("Build117 candidate switch or resume replacement remounts sensitive preview", () => {
  assert(resume.includes('key={props.candidateId + ":" + (props.resumeUrl ?? "")}'));
  assert(resume.includes("function CandidateResumeSummary("));
  assert(resume.includes("setShowResumeText(false);"));
  assert(resume.includes("genMut.reset();"));
  assert(resume.includes("setSavedSummary(resumeSummary);"));
  assert(resume.includes("safeResumeHref(resumeUrl)"));
});
