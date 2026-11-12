import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseExactCount} from "./exact-content-range.mjs";

test("strict Content-Range accepts only coherent bounded or star totals",()=>{
 for(const [input,total] of [
  ["*/0",0],["*/1",1],["0-0/1",1],["0-0/5",5],
  ["1-3/8",8],[" 0-1/2 ",2],["*/9007199254740991",9007199254740991]
 ])assert.equal(parseExactCount(input),total,input);
 for(const input of [
  null,undefined,"", "1","*/","*/-1","0-0/*","0-1/1","1-0/1",
  "0-0/0","5-10/10","20-30/1","0-0/9007199254740992",
  "*/9007199254740992","0-0/1 trailing","0-0/1\nBAD","0-0/01/foo",
  "0-0/-2","0-0/NaN"
 ])assert.equal(parseExactCount(input),null,String(input));
});
test("all three hosted count readers use one verified parser, not permissive duplicates",()=>{
 const scripts=[
  "security/build64/hosted-135-readonly.mjs",
  "security/build66/hosted-anon-extra-scope.mjs",
  "security/build68/hosted-positive-controls.mjs"
 ];
 for(const file of scripts){
  const source=readFileSync(file,"utf8");
  assert.match(source,/exact-content-range\.mjs/);
  assert.match(source,/parseExactCount/);
  assert.doesNotMatch(source,/\/\^\(\?:\\\*\|\\d\+-\\d\+\)/);
 }
});
