import test from "node:test";
import assert from "node:assert/strict";
import { rowsToCsv } from "../src/lib/csv.ts";

test("CSV exports neutralize user-supplied spreadsheet formulas, including padded attacks", () => {
  const csv = rowsToCsv(
    ["Company", "Value"],
    [
      ['=HYPERLINK("https://example.invalid","click")', -125],
      ["+SUM(1,1)", 0],
      ["@NOW()", 42],
      ["-2+3", 8],
      ["  =2+2", 99],
      ["\u200b=IMPORTXML(\"https://example.invalid\",\"//p\")", 3],
      ["\ufeff@SUM(1)", 4],
      ["\t+23", 5],
      ["-125", 6],
    ],
  );
  for (const value of ["'=HYPERLINK", "'+SUM", "'@NOW()", "'-2+3", "'  =2+2", "'\u200b=IMPORTXML", "'\ufeff@SUM(1)", "'\t+23", "'-125"]) {
    assert.ok(csv.includes(value), "Missing neutralized cell: " + JSON.stringify(value));
  }
  assert.match(csv, /,-125\r\n/);
  assert.ok(!csv.includes(',"=HYPERLINK'));
});
test("Ordinary CSV values retain CSV structural quoting, UTF-8 text, and CRLF", () => {
  const csv=rowsToCsv(["Name", "Count"],[["Acme, Inc.",3],['Jane "quoted" Doe',2],["Line\nBreak",1],["₹1,500",0]]);
  assert.ok(csv.includes('"Acme, Inc.",3'));
  assert.ok(csv.includes('"Jane ""quoted"" Doe",2'));
  assert.ok(csv.includes('"Line\nBreak",1'));
  assert.ok(csv.includes('"₹1,500",0'));
  assert.ok(csv.includes("\r\n"));
});
test("Headers are neutralized too, with no change to numeric negatives", () => {
  const csv=rowsToCsv(["=DANGEROUS", "Value"],[[-12, "normal"]]);
  assert.ok(csv.startsWith("'=DANGEROUS,Value\r\n-12,normal"));
});
