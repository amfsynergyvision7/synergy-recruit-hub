import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canReadPrivateUserDirectory } from "../../src/lib/crm-sensitive-route-access.ts";
import { LEGACY_CANDIDATE_WRITES_PAUSED } from "../../src/lib/release-safety.ts";

const source=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const page=source("src/routes/_app.duplicates.tsx");
const srv=source("src/lib/duplicates.functions.ts");
const scanning=source("src/lib/duplicates.server.ts");
const paging=source("src/lib/duplicate-scan-pagination.ts");
const approved={id:"admin-a",status:"approved",is_active:true};

test("Build136 source gate limits private contact duplicate review to exact approved admin",()=>{
 assert.equal(canReadPrivateUserDirectory("admin-a",approved,"admin"),true);
 for(const role of ["recruiter","operations","finance","viewer",null])
   assert.equal(canReadPrivateUserDirectory("admin-a",approved,role),false);
 assert.equal(canReadPrivateUserDirectory("other",approved,"admin"),false);
 assert(page.includes('role !== "admin"'));
 assert(page.includes('profile.id !== user.id'));
 assert(page.includes('profile.is_active !== true'));
});

test("Build136 server repeats unique signed admin role check before reading any candidate contacts",()=>{
 assert(srv.includes("requireSupabaseAuth"));
 assert(srv.includes('await assertApprovedRole(context.userId, ["admin"])'));
 assert(scanning.includes('await assertApprovedRole(actorUserId, ["admin"])'));
 assert(srv.indexOf('await assertApprovedRole(context.userId, ["admin"])')<
        srv.indexOf("return findDuplicateClusters("));
});

test("Build136 admin duplicate-scan errors never render raw server diagnostics",()=>{
 assert(page.includes("Complete duplicate review is unavailable. No candidate records or diagnostic details are displayed."));
 assert(!page.includes("(query.error as any)?.message"));
 assert(!page.includes("query.error.message"));
 assert(!page.includes("JSON.stringify(query.error"));
 assert(!page.includes("toast.error(error.message)"));
});

test("Build136 failed duplicate scan hides all clusters and counts, not a fake empty history",()=>{
 assert(page.includes("query.isError || query.isFetching ? undefined : query.data"));
 assert(page.includes("summary?.clusters ?? []"));
 assert(page.includes("query.isError && !query.isPending"));
 assert(page.includes("summary && !query.isPending"));
});

test("Build136 status and source do not expose candidate deletion paths",()=>{
 assert.equal(LEGACY_CANDIDATE_WRITES_PAUSED,true);
 assert(page.includes('toast.error(CANDIDATE_MUTATION_HOLD_REASON)'));
 assert(page.includes("disabled={selectedCount === 0 || deleting || LEGACY_CANDIDATE_WRITES_PAUSED}"));
 assert(!page.includes('supabase.from("candidates").delete('));
 assert(!page.includes('supabase.from("candidates").update('));
});

test("Build136 only approved admin can cache duplicate review and state is account-keyed",()=>{
 assert(page.includes('return <AdminDuplicateReview key={user.id} userId={user.id} />'));
 assert(page.includes('queryKey: ["duplicate-candidates", userId]'));
 assert(page.includes("refetchOnMount: \"always\""));
});

test("Build136 live scan checks all pages, exact count and ID order without partial exposure",()=>{
 assert(paging.includes("count > MAX_COMPLETE_DUPLICATE_SCAN"));
 assert(paging.includes("result[offset + i]?.id !== row.id"));
 assert(paging.includes("if (result.length !== expectedTotal)"));
 assert(paging.includes("if (error || !Number.isSafeInteger(count)"));
 assert(paging.includes("throw new Error(UNAVAILABLE)"));
});

test("Build136 raw database error message cannot leak through duplicate scan paging",()=>{
 assert(paging.includes("catch {"));
 assert(paging.includes("throw new Error(UNAVAILABLE)"));
 assert(!paging.includes("throw error"));
 assert(!paging.includes("throw response.error"));
});

test("Build136 export is review-only and requires successfully completed scan",()=>{
 assert(page.includes("if (!summary || query.isError || query.isFetching)"));
 assert(page.includes("buildDuplicateReviewCSV(clusters, selected)"));
 assert(page.includes("candidate-duplicate-review-NOT-APPROVED.csv"));
 assert(page.includes("No candidate was modified or deleted"));
});

test("Build136 scan is still backed by narrow candidate fields rather than wildcard",()=>{
 assert(!scanning.includes('select("*")'));
 assert(scanning.includes("id, full_name, candidate_code, email, mobile"));
 assert(scanning.includes("position_applied, stage, status, source"));
});
