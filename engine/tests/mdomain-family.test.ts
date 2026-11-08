// Author: JoonHo Lee (jlee296@ua.edu).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mdomainInput } from "../src/mdomain/input.ts";
import { mdomainFamily, candidateKey, enumerateCards, validateFamily } from "../src/mdomain/family.ts";
import { MdomainError } from "../src/mdomain/error.ts";
import type { MdomainErrorCode } from "../src/mdomain/error.ts";
import type { GradeMatrix, MdomainFamily, MdomainFixture } from "../src/mdomain/types.ts";

const root = new URL("../../", import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const manifest = read("verification/golden/v35/manifest.json");
const fixtures: MdomainFixture[] = manifest.fixtures.map((entry: { path: string }) => read(entry.path));
const baseFixture = fixtures.find((fixture) => fixture.fixtureId === "common-aligned-ordinary-equal")!;
const baseInput = () => mdomainInput(structuredClone(baseFixture.input));
const baseSpec = () => structuredClone(baseFixture.family);

function rejects(action: () => unknown, code: MdomainErrorCode, fieldPrefix?: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof MdomainError);
    assert.equal(error.code, code);
    if (fieldPrefix) assert.ok(error.field.startsWith(fieldPrefix), error.field);
    assert.doesNotThrow(() => JSON.stringify(error));
    return true;
  });
}

test("all 57 R fixture products match all 494 portable candidate keys and grade matrices in order", () => {
  assert.equal(fixtures.length, 57);
  let count = 0;
  for (const fixture of fixtures) {
    const family = mdomainFamily(mdomainInput(fixture.input), fixture.family);
    const cards = enumerateCards(family);
    const expected = fixture.expected!.fit.candidateTable;
    assert.equal(family.candidateCount, expected.length, fixture.fixtureId);
    assert.deepEqual(cards, expected.map((row) => row.grades), fixture.fixtureId);
    assert.deepEqual(cards.map(candidateKey), expected.map((row) => row.candidateId), fixture.fixtureId);
    assert.deepEqual(validateFamily(fixture.input, family), family);
    count += cards.length;
  }
  assert.equal(count, 494);
});

test("family order and product-cap negative ledger records retain their declared codes", () => {
  const selected = read("verification/golden/v35/negative-cases.json").cases.filter((entry: { caseId: string }) =>
    entry.caseId === "family-order" || entry.caseId === "product-cap");
  assert.equal(selected.length, 2);
  for (const entry of selected) {
    rejects(() => mdomainFamily(mdomainInput(entry.payload.input), entry.payload.family), entry.expectedBrowserCode);
  }
});

test("empty supplied banks become one complete all-withheld card without fabricated aliases", () => {
  const spec = baseSpec(); spec.banks.forEach((bank) => { bank.columns = []; }); spec.maxActions = 1;
  const family = mdomainFamily(baseInput(), spec);
  assert.equal(family.candidateCount, 1);
  assert.deepEqual(family.sourceSpec.banks.map((bank) => bank.columns), [[], []]);
  assert.deepEqual(family.banks.map((bank) => bank.columns), [
    [{ columnId: "g:1,1", aliases: [], grades: [1, 1] }],
    [{ columnId: "g:1,1", aliases: [], grades: [1, 1] }],
  ]);
  assert.deepEqual(enumerateCards(family).map(candidateKey), ["p:1,1|1,1"]);
});

test("canonical duplicates merge all source aliases and preserve original raw labels", () => {
  const spec = baseSpec();
  spec.banks[0].columns = [
    { columnId: "forward", grades: [10, 20] },
    { columnId: "forward-gap", grades: [-9, 999] },
    { columnId: "supplied-withhold", grades: [7, 7] },
    { columnId: "same-withhold", grades: [-3, -3] },
  ];
  const family = mdomainFamily(baseInput(), spec);
  assert.deepEqual(family.banks[0].columns, [
    { columnId: "g:1,1", aliases: ["supplied-withhold", "same-withhold"], grades: [1, 1] },
    { columnId: "g:1,2", aliases: ["forward", "forward-gap"], grades: [1, 2] },
  ]);
  assert.deepEqual(family.sourceSpec.banks[0].columns, spec.banks[0].columns);
  assert.equal(family.candidateCount, 6);
});

test("automatic all-withheld columns are counted before any product enumeration", () => {
  const spec = baseSpec();
  spec.banks.forEach((bank) => { bank.columns = [{ columnId: "forward", grades: [1, 2] }]; });
  spec.maxActions = 1;
  rejects(() => mdomainFamily(baseInput(), spec), "mdomainResourceCap", "family.maxActions");
  spec.maxActions = 4;
  const family = mdomainFamily(baseInput(), spec);
  assert.equal(family.candidateCount, 4);
  assert.deepEqual(family.banks[0].columns[0], { columnId: "g:1,1", aliases: [], grades: [1, 1] });
});

test("the raw-bank bound precedes traversal while deduplication precedes the canonical-product bound", () => {
  const spec = baseSpec();
  spec.maxActions = 4;
  spec.banks.forEach((bank) => {
    bank.columns = Array.from({ length: 256 }, (_, i) => ({ columnId: `alias-${i}`, grades: [1, 2] }));
  });
  const family = mdomainFamily(baseInput(), spec);
  assert.equal(family.candidateCount, 4);
  assert.equal(family.banks[0].columns[1].aliases.length, 256);
  const oversized = baseSpec(); oversized.banks[0].columns = new Array(257);
  rejects(() => mdomainFamily(baseInput(), oversized), "mdomainResourceCap", "family.banks[0].columns");
});

test("limits and grade caps reject instead of coercing or merging a supplied direction", () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const spec = baseSpec(); spec.maxActions = value;
    rejects(() => mdomainFamily(baseInput(), spec), "mdomainFamilyInvalid", "family.maxActions");
  }
  const outside = baseSpec(); outside.maxActions = 257;
  rejects(() => mdomainFamily(baseInput(), outside), "mdomainResourceCap", "family.maxActions");
  const cap = baseSpec(); cap.maxGrades[0] = 1;
  rejects(() => mdomainFamily(baseInput(), cap), "mdomainFamilyInvalid", "family.banks[0]");
  for (const value of [0, 1.5, 3, NaN]) {
    const spec = baseSpec(); spec.maxGrades[0] = value;
    rejects(() => mdomainFamily(baseInput(), spec), "mdomainFamilyInvalid", "family.maxGrades");
  }
});

test("supplied column IDs are unique per bank and nested unknown fields reject", () => {
  const repeated = baseSpec(); repeated.banks[0].columns[1].columnId = repeated.banks[0].columns[0].columnId;
  rejects(() => mdomainFamily(baseInput(), repeated), "mdomainFamilyInvalid", "family.banks[0]");
  const unknown = baseSpec(); (unknown as unknown as Record<string, unknown>).extra = true;
  rejects(() => mdomainFamily(baseInput(), unknown), "mdomainFamilyInvalid", "family.extra");
  const bankExtra = baseSpec(); (bankExtra.banks[0] as unknown as Record<string, unknown>).extra = true;
  rejects(() => mdomainFamily(baseInput(), bankExtra), "mdomainFamilyInvalid", "family.banks[0].extra");
  const columnExtra = baseSpec(); (columnExtra.banks[0].columns[0] as unknown as Record<string, unknown>).extra = true;
  rejects(() => mdomainFamily(baseInput(), columnExtra), "mdomainFamilyInvalid", "family.banks[0].columns[0].extra");
  assert.doesNotThrow(() => mdomainFamily(baseInput(), baseSpec()));
});

test("identity vectors and bank order match input exactly", () => {
  for (const key of ["unitIds", "domainIds"] as const) {
    const spec = baseSpec(); spec[key].reverse();
    rejects(() => mdomainFamily(baseInput(), spec), "mdomainIdentityMismatch", `family.${key}`);
  }
  const spec = baseSpec(); spec.banks.reverse();
  rejects(() => mdomainFamily(baseInput(), spec), "mdomainIdentityMismatch", "family.banks[0].domainId");
});

test("raw grade errors and structural-class splits are typed family errors", () => {
  for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "1", null]) {
    const spec = baseSpec(); (spec.banks[0].columns[0].grades as unknown[])[0] = value;
    rejects(() => mdomainFamily(baseInput(), spec), "mdomainFamilyInvalid", "family.banks[0].columns[0].grades");
  }
  const fixture = fixtures.find((entry) => entry.fixtureId === "boundary-structural-identity")!;
  const spec = structuredClone(fixture.family);
  spec.banks[0].columns = [{ columnId: "split", grades: [1, 2, 3] }];
  rejects(() => mdomainFamily(fixture.input, spec), "mdomainFamilyInvalid", "family.banks[0].columns[0].grades");
});

test("source specifications, construction inputs, canonical banks and enumerated cards own their arrays", () => {
  const input = baseInput(); const spec = baseSpec();
  const beforeInput = structuredClone(input); const beforeSpec = structuredClone(spec);
  const family = mdomainFamily(input, spec);
  assert.deepEqual(input, beforeInput); assert.deepEqual(spec, beforeSpec);
  spec.banks[0].columns[0].grades[0] = -99;
  input.states[0][0][0] = 99;
  assert.deepEqual(family.sourceSpec, beforeSpec); assert.deepEqual(family.constructionInput, beforeInput);
  const cards = enumerateCards(family);
  cards[0].values[0][0] = 99; cards[0].unitIds[0] = "changed";
  assert.deepEqual(enumerateCards(family)[0].values, [[1, 1], [1, 1]]);
  assert.deepEqual(cards[1].unitIds, ["A", "B"]);
  family.sourceSpec.banks[0].columns[0].grades[0] = -7;
  assert.deepEqual(family.banks[0].columns[0].grades, [1, 1]);
});

test("same readable IDs with a changed law cannot reuse a constructed family", () => {
  const input = baseInput(); const family = mdomainFamily(input, baseSpec());
  const changed = structuredClone(input); changed.states[0][0][0] = 2;
  assert.equal(changed.inputId, input.inputId);
  rejects(() => validateFamily(changed, family), "mdomainIdentityMismatch", "family.constructionInput");
  const inputInvalid = structuredClone(input); inputInvalid.masses[0] = "4/5";
  rejects(() => mdomainFamily(inputInvalid, baseSpec()), "mdomainInputInvalid");
});

test("runtime derived banks, aliases, counts and markers are revalidated from the source", () => {
  const input = baseInput();
  const mutate: Array<(family: MdomainFamily) => void> = [
    (family) => { family.candidateCount = 1; },
    (family) => { family.banks[0].columns.reverse(); },
    (family) => { family.banks[0].columns[0].grades[0] = 2; },
    (family) => { family.banks[0].columns[0].aliases.push("invented"); },
    (family) => { family.sourceSpec.banks[0].columns[0].columnId = "changed"; },
    (family) => { (family as unknown as Record<string, unknown>).class = "validated"; },
  ];
  for (const apply of mutate) {
    const family = mdomainFamily(input, baseSpec()); apply(family);
    rejects(() => validateFamily(input, family), "mdomainFamilyInvalid");
    rejects(() => enumerateCards(family), "mdomainFamilyInvalid");
  }
  const changed = mdomainFamily(input, baseSpec()); changed.constructionInput.masses[0] = "4/5";
  rejects(() => validateFamily(input, changed), "mdomainFamilyInvalid", "family.constructionInput");
});

test("runtime validation accepts semantic record-key reordering and returns a fresh owning family", () => {
  const input = baseInput(); const family = mdomainFamily(input, baseSpec());
  family.banks = family.banks.map((bank) => ({ columns: bank.columns.map((column) => ({ grades: column.grades, aliases: column.aliases, columnId: column.columnId })), domainId: bank.domainId }));
  const checked = validateFamily(input, family);
  assert.deepEqual(checked, mdomainFamily(input, baseSpec()));
  assert.notEqual(checked, family);
  checked.banks[0].columns[0].grades[0] = 4;
  assert.equal(family.banks[0].columns[0].grades[0], 1);
});

test("candidate keys serialize canonical unit-by-domain matrices in domain-major order", () => {
  const values = [[1, 2], [3, 1], [2, 3]];
  const matrix: GradeMatrix = { unitIds: ["A", "B", "C"], domainIds: ["S", "C"], values };
  assert.equal(candidateKey(values), "p:1,3,2|2,1,3");
  assert.equal(candidateKey(matrix), "p:1,3,2|2,1,3");
  for (const bad of [[[1], [3], [3]], [[10], [20]], [[1, 1], [2]], [[1.5], [2]], []]) {
    rejects(() => candidateKey(bad), "mdomainGradesInvalid");
  }
});

test("enumeration varies the last domain fastest", () => {
  const family = mdomainFamily(baseInput(), baseSpec());
  assert.deepEqual(enumerateCards(family).map(candidateKey), [
    "p:1,1|1,1", "p:1,1|1,2", "p:1,1|2,1",
    "p:1,2|1,1", "p:1,2|1,2", "p:1,2|2,1",
    "p:2,1|1,1", "p:2,1|1,2", "p:2,1|2,1",
  ]);
});

test("numeric column lexicographic order takes precedence over fewer occupied grades", () => {
  const input = baseInput(); input.unitIds.push("C");
  input.targets.forEach((target) => { target.equalityClasses.push("C"); });
  input.states.forEach((state) => { state.push([-2, -2]); });
  const spec = baseSpec(); spec.unitIds.push("C"); spec.maxGrades = [3, 3];
  spec.banks[0].columns = [
    { columnId: "two-grades", grades: [2, 1, 1] },
    { columnId: "three-grades", grades: [1, 2, 3] },
  ];
  spec.banks[1].columns = [];
  assert.deepEqual(enumerateCards(mdomainFamily(input, spec)).map(candidateKey), [
    "p:1,1,1|1,1,1", "p:1,2,3|1,1,1", "p:2,1,1|1,1,1",
  ]);
});
