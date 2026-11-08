// Author: JoonHo Lee (jlee296@ua.edu).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mdomainInput } from "../src/mdomain/input.ts";
import { mdomainGrades } from "../src/mdomain/grades.ts";
import { MdomainError } from "../src/mdomain/error.ts";
import type { MdomainErrorCode } from "../src/mdomain/error.ts";
import type { GradeMatrix, MdomainFixture, MdomainInputSpec } from "../src/mdomain/types.ts";

const root = new URL("../../", import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const manifest = read("verification/golden/v35/manifest.json");
const fixtures: MdomainFixture[] = manifest.fixtures.map((entry: { path: string }) => read(entry.path));
const base = () => structuredClone(fixtures.find((fixture) => fixture.fixtureId === "common-aligned-ordinary-equal")!.input);
const grades = (): GradeMatrix => ({ unitIds: ["A", "B"], domainIds: ["one", "two"], values: [[1, 1], [2, 2]] });

function rejects(action: () => unknown, code: MdomainErrorCode, fieldPrefix?: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof MdomainError);
    assert.equal(error.code, code);
    assert.equal(typeof error.field, "string");
    if (fieldPrefix) assert.ok(error.field.startsWith(fieldPrefix), error.field);
    assert.doesNotThrow(() => JSON.stringify(error));
    return true;
  });
}

test("all 57 public R fixtures retain their input values and canonical candidate grades", () => {
  assert.equal(fixtures.length, 57);
  let candidates = 0;
  for (const fixture of fixtures) {
    const checked = mdomainInput(fixture.input);
    assert.deepEqual(checked, fixture.input, fixture.fixtureId);
    assert.notEqual(checked, fixture.input);
    for (const candidate of fixture.expected!.fit.candidateTable) {
      assert.deepEqual(mdomainGrades(checked, candidate.grades), candidate.grades, `${fixture.fixtureId}: ${candidate.candidateId}`);
      candidates += 1;
    }
  }
  assert.equal(candidates, 494);
});

test("applicable negative-ledger records reject with their declared browser categories", () => {
  const cases = read("verification/golden/v35/negative-cases.json").cases;
  const selected = cases.filter((entry: { expectedBrowserCode: string }) =>
    entry.expectedBrowserCode === "mdomainInputInvalid" || entry.expectedBrowserCode === "mdomainUnsupported");
  assert.equal(selected.length, 6);
  for (const entry of selected) rejects(() => mdomainInput(entry.payload.input), entry.expectedBrowserCode);
});

test("validated inputs own all nested arrays and records without mutating frozen specifications", () => {
  const original = base();
  const before = structuredClone(original);
  const freeze = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  };
  freeze(original);
  const checked = mdomainInput(original);
  assert.deepEqual(original, before);
  checked.states[0][0][0] = 123;
  checked.targets[0].equalityClasses[0] = "changed";
  checked.provenance.producer = "changed";
  checked.unitIds[0] = "changed";
  checked.masses[0] = "0";
  assert.deepEqual(original, before);
});

test("IDs are unique within namespaces, case-sensitive, nonblank, ordered and never trimmed", () => {
  for (const field of ["unitIds", "domainIds", "stateIds"] as const) {
    const duplicate = base(); duplicate[field][1] = duplicate[field][0];
    rejects(() => mdomainInput(duplicate), "mdomainInputInvalid", `input.${field}`);
    const blank = base(); blank[field][0] = " \t";
    rejects(() => mdomainInput(blank), "mdomainInputInvalid", `input.${field}`);
  }
  const shared = base();
  shared.unitIds = [" A ", "A"];
  shared.domainIds = [" A ", "A"];
  shared.stateIds = [" A ", "A"];
  shared.targets.forEach((target, i) => { target.domainId = shared.domainIds[i]; });
  assert.deepEqual(mdomainInput(shared).unitIds, [" A ", "A"]);
  const caseSensitive = base(); caseSensitive.unitIds = ["A", "a"];
  assert.deepEqual(mdomainInput(caseSensitive).unitIds, ["A", "a"]);
});

test("dimension bounds reject before traversing oversized inputs and accept D=1 fixtures", () => {
  for (const [field, values] of [["unitIds", ["A"]], ["domainIds", []], ["stateIds", []]] as const) {
    const spec = base(); (spec as unknown as Record<string, unknown>)[field] = [...values];
    rejects(() => mdomainInput(spec), "mdomainInputInvalid", `input.${field}`);
  }
  for (const [field, count] of [["unitIds", 5], ["domainIds", 3], ["stateIds", 9]] as const) {
    const spec = base(); spec[field] = Array.from({ length: count }, (_, i) => `id-${i}`);
    rejects(() => mdomainInput(spec), "mdomainResourceCap", `input.${field}`);
  }
  assert.ok(fixtures.some((fixture) => mdomainInput(fixture.input).domainIds.length === 1));
});

test("every state dimension, including zero-mass rows, must match the declared shape", () => {
  const mutations: Array<(spec: MdomainInputSpec) => void> = [
    (spec) => { spec.states.pop(); },
    (spec) => { spec.states[0].pop(); },
    (spec) => { spec.states[0][0].pop(); },
    (spec) => { delete spec.states[0][0][0]; },
  ];
  for (const mutate of mutations) { const spec = base(); mutate(spec); rejects(() => mdomainInput(spec), "mdomainInputInvalid", "input.states"); }
});

test("masses are canonical strings with an exact unit sum and no numeric coercion", () => {
  const badValues: unknown[] = [0.9, "0.9", "9/010", "18/20", "-1/10", "1/0", "1/1", "0/2", "9/10 ", "1".repeat(257)];
  for (const value of badValues) {
    const spec = base(); (spec.masses as unknown[])[0] = value;
    rejects(() => mdomainInput(spec), "mdomainInputInvalid", "input.masses");
  }
  const total = base(); total.masses[0] = "4/5";
  rejects(() => mdomainInput(total), "mdomainInputInvalid", "input.masses");
  const wrongLength = base(); wrongLength.masses.pop();
  rejects(() => mdomainInput(wrongLength), "mdomainInputInvalid", "input.masses");
});

test("finite binary64 targets are retained; nonfinite, unsafe or nonnumeric targets reject", () => {
  const spec = base(); spec.states[0][0][0] = 0.1;
  assert.equal(mdomainInput(spec).states[0][0][0], 0.1);
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, -Number.MAX_SAFE_INTEGER - 1, "1", null, 1n]) {
    const bad = base(); (bad.states[0][0] as unknown[])[0] = value;
    rejects(() => mdomainInput(bad), "mdomainInputInvalid", "input.states");
  }
});

test("targets require explicit ordered identities, orientation, metadata and declared equality labels", () => {
  const swapped = base(); swapped.targets.reverse();
  rejects(() => mdomainInput(swapped), "mdomainIdentityMismatch", "input.targets");
  for (const field of ["definition", "units", "equalityProvenance"] as const) {
    const spec = base(); spec.targets[0][field] = " ";
    rejects(() => mdomainInput(spec), "mdomainInputInvalid", "input.targets");
  }
  const orientation = base(); (orientation.targets[0] as unknown as Record<string, unknown>).orientation = "smaller_is_higher";
  rejects(() => mdomainInput(orientation), "mdomainInputInvalid", "input.targets");
  const classes = base(); classes.targets[0].equalityClasses.pop();
  rejects(() => mdomainInput(classes), "mdomainInputInvalid", "input.targets");
});

test("structural identity uses positive masses, while its grade ties remain compulsory", () => {
  const fixture = fixtures.find((entry) => entry.fixtureId === "boundary-zero-mass-identity")!;
  const checked = mdomainInput(fixture.input);
  assert.equal(checked.masses[1], "0");
  assert.notEqual(checked.states[1][0][0], checked.states[1][1][0]);
  const violated = structuredClone(fixture.input); violated.states[0][1][0] = 2;
  rejects(() => mdomainInput(violated), "mdomainInputInvalid", "input.targets");
  const split = structuredClone(fixture.expected!.fit.selectedGrades); split.values[1][0] = 2;
  rejects(() => mdomainGrades(checked, split), "mdomainGradesInvalid");
  const ordinaryTie = base(); ordinaryTie.states[0][0][0] = ordinaryTie.states[0][1][0];
  assert.deepEqual(mdomainGrades(mdomainInput(ordinaryTie), grades()), grades());
});

test("all required provenance declarations are present and properLaw is literally true", () => {
  for (const key of ["producer", "conditioningInfo", "jointGeneration", "finiteSupportOrigin"] as const) {
    const spec = base(); spec.provenance[key] = "";
    rejects(() => mdomainInput(spec), "mdomainInputInvalid", "input.provenance");
  }
  const spec = base(); (spec.provenance as unknown as Record<string, unknown>).properLaw = 1;
  rejects(() => mdomainInput(spec), "mdomainInputInvalid", "input.provenance.properLaw");
});

test("unknown fields, class markers, accessors and nonordinary records are not trusted", () => {
  const spec = base(); (spec as unknown as Record<string, unknown>).class = "validated";
  rejects(() => mdomainInput(spec), "mdomainInputInvalid", "input.class");
  const target = base(); (target.targets[0] as unknown as Record<string, unknown>).extra = true;
  rejects(() => mdomainInput(target), "mdomainInputInvalid", "input.targets");
  const provenance = base(); (provenance.provenance as unknown as Record<string, unknown>).extra = true;
  rejects(() => mdomainInput(provenance), "mdomainInputInvalid", "input.provenance");
  let readAccessor = false;
  const accessor = base(); Object.defineProperty(accessor, "inputId", { enumerable: true, get() { readAccessor = true; return "hidden"; } });
  rejects(() => mdomainInput(accessor), "mdomainInputInvalid"); assert.equal(readAccessor, false);
  rejects(() => mdomainInput(new Date() as unknown as MdomainInputSpec), "mdomainInputInvalid");
  const withSymbol = base(); Object.defineProperty(withSymbol, Symbol("hidden"), { value: true });
  rejects(() => mdomainInput(withSymbol), "mdomainInputInvalid");
});

test("raw integer grade labels canonicalise by numeric order, preserving ties and IDs", () => {
  const input = mdomainInput(base());
  const supplied = grades(); supplied.values = [[10, -3], [30, -3]];
  const before = structuredClone(supplied);
  assert.deepEqual(mdomainGrades(input, supplied), { ...grades(), values: [[1, 1], [2, 1]] });
  assert.deepEqual(supplied, before);
  supplied.values = [[Number.MAX_SAFE_INTEGER, 0], [-Number.MAX_SAFE_INTEGER, -0]];
  assert.deepEqual(mdomainGrades(input, supplied).values, [[2, 1], [1, 1]]);
});

test("grade validation rejects unsafe/noninteger labels, shapes, unknown fields and reordered IDs", () => {
  const input = mdomainInput(base());
  for (const value of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null, 1n]) {
    const supplied = grades(); (supplied.values[0] as unknown[])[0] = value;
    rejects(() => mdomainGrades(input, supplied), "mdomainGradesInvalid");
  }
  for (const key of ["unitIds", "domainIds"] as const) {
    const supplied = grades(); supplied[key].reverse();
    rejects(() => mdomainGrades(input, supplied), "mdomainIdentityMismatch", `grades.${key}`);
  }
  const row = grades(); row.values[0].pop(); rejects(() => mdomainGrades(input, row), "mdomainGradesInvalid");
  const extra = grades(); (extra as unknown as Record<string, unknown>).extra = true;
  rejects(() => mdomainGrades(input, extra), "mdomainGradesInvalid", "grades.extra");
});

test("grade validation returns owning matrices and revalidates changed input content", () => {
  const input = mdomainInput(base());
  const supplied = grades(); const result = mdomainGrades(input, supplied);
  result.values[0][0] = 9; result.unitIds[0] = "changed";
  assert.deepEqual(supplied, grades());
  input.masses[0] = "4/5";
  rejects(() => mdomainGrades(input, supplied), "mdomainInputInvalid", "input.masses");
});
