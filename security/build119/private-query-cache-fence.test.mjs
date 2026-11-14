import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPrivateCacheFence, clearPrivateCacheForIdentity } from "../../src/lib/private-query-cache-fence.ts";
const file = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const auth = file("src/hooks/use-auth.tsx"), root = file("src/routes/__root.tsx");
test("Build119 account A to B to A removes all cached private data",()=>{
 const f=createPrivateCacheFence(),cache={query:[],mutations:[],clear(){this.query=[];this.mutations=[];}};
 assert.equal(clearPrivateCacheForIdentity(f,cache,"A"),true);
 cache.query.push("private A");cache.mutations.push("A action");
 assert.equal(clearPrivateCacheForIdentity(f,cache,"B"),true);
 assert.deepEqual(cache.query,[]);assert.deepEqual(cache.mutations,[]);
 cache.query.push("private B");clearPrivateCacheForIdentity(f,cache,"A");
 assert.deepEqual(cache.query,[]);assert.equal(f.current(),"A");
});
test("Build119 same-user token refresh does not unnecessarily clear caches",()=>{
 const f=createPrivateCacheFence();let calls=0;const c={clear(){calls++}};
 assert.equal(clearPrivateCacheForIdentity(f,c,"A"),true);
 assert.equal(clearPrivateCacheForIdentity(f,c,"A"),false);
 assert.equal(clearPrivateCacheForIdentity(f,c,"A"),false);
 assert.equal(calls,1);
});
test("Build119 permission refresh purges same-account caches",()=>{
 const f=createPrivateCacheFence();let calls=0;const c={clear(){calls++}};
 clearPrivateCacheForIdentity(f,c,"A");
 assert.equal(clearPrivateCacheForIdentity(f,c,"A",true),true);
 assert.equal(calls,2);
});
test("Build119 sign-out clears private cache and new account cannot inherit it",()=>{
 const f=createPrivateCacheFence();let calls=0;const c={clear(){calls++}};
 clearPrivateCacheForIdentity(f,c,"A");clearPrivateCacheForIdentity(f,c,null,true);
 assert.equal(f.current(),null);assert.equal(clearPrivateCacheForIdentity(f,c,null),false);
 clearPrivateCacheForIdentity(f,c,"B");assert.equal(calls,3);
});
test("Build119 malformed Auth subject is refused without changing cache owner",()=>{
 const f=createPrivateCacheFence(),c={clear(){}};
 clearPrivateCacheForIdentity(f,c,"A");
 for(const x of ["",undefined,false,123])
   assert.throws(()=>clearPrivateCacheForIdentity(f,c,x),/Invalid signed-in cache subject/);
 assert.equal(f.current(),"A");
});
test("Build119 AuthProvider purges caches before session change, refresh and logout",()=>{
 assert(auth.includes("const queryClient = useQueryClient();"));
 assert(auth.includes("clearPrivateCacheForIdentity(privateCacheOwner.current, queryClient, userId, force)"));
 assert(auth.indexOf("purgePrivateQueries(ticket.userId);")<auth.indexOf("setSession(next);"));
 assert(auth.includes("purgePrivateQueries(userId, true);"));
 assert(auth.indexOf("purgePrivateQueries(null, true);")<auth.indexOf("await supabase.auth.signOut();"));
 assert(root.includes("<QueryClientProvider client={queryClient}>"));
 assert(root.includes("<AuthProvider>"));
});
test("Build119 root error boundary cannot display or log exception messages",()=>{
 const e=root.slice(root.indexOf("function ErrorComponent("),root.indexOf("export const Route = "));
 assert(e.includes("This page could not be loaded."));
 assert(!e.includes("console.error(error)"));assert(!e.includes("error.message"));
 assert(!e.includes("error instanceof Error"));
});
