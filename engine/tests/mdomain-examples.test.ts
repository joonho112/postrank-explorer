// Author: JoonHo Lee (jlee296@ua.edu).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mdomainExample } from "../src/mdomain/examples.ts";
import { mdomainInput } from "../src/mdomain/input.ts";
import { MdomainError } from "../src/mdomain/error.ts";
import type { MdomainFixture } from "../src/mdomain/types.ts";

const root = resolve(import.meta.dirname, "../..");
function oracle(name: string): MdomainFixture {
  return JSON.parse(readFileSync(resolve(root, "verification/golden/v35", name + ".json"), "utf8"));
}
// Domain labels one/two in historical common/separable examples are renamed S/C
// positionally by this teaching factory. Targets, masses, identity classes and all
// policy/candidate mathematical quantities must match the independent R request.
function mathematics(x: MdomainFixture): unknown {
  // The resolution R exporter uses an allocation cap of 256; the factory uses
  // a tighter cap of 9. Both admit exactly the same explicit 3-by-3 bank.
  assert.deepEqual(x.family.banks.map(b => b.columns.length), [3, 3]);
  assert.ok(x.family.maxActions >= 9 && x.family.maxActions <= 256);
  return {
    unitIds: x.input.unitIds, domainCount: x.input.domainIds.length,
    stateIds: x.input.stateIds, states: x.input.states, masses: x.input.masses,
    targets: x.input.targets.map(t => ({ orientation: t.orientation, equalityClasses: t.equalityClasses })),
    representation: x.input.representation, coupling: x.input.coupling,
    weights: x.decision.weights, tau: x.decision.tau, q: x.decision.q, t: x.decision.t,
    alpha: x.decision.alpha, scope: x.decision.scope,
    maxGrades: x.family.maxGrades,
    columns: x.family.banks.map(b => b.columns.map(c => c.grades)),
  };
}
function validRequest(x: MdomainFixture): void {
  assert.equal(x.schemaVersion, "postrank-explorer-mdomain-v1");
  assert.deepEqual(x.input.unitIds, ["A", "B"]);
  assert.deepEqual(x.input.domainIds, ["S", "C"]);
  assert.deepEqual(x.decision.domainIds, x.input.domainIds);
  assert.deepEqual(x.family.unitIds, x.input.unitIds);
  assert.deepEqual(x.family.domainIds, x.input.domainIds);
  assert.equal(x.family.maxActions, 9);
  assert.deepEqual(x.family.maxGrades, [2, 2]);
  assert.equal(Object.hasOwn(x, "expected"), false);
  assert.equal(Object.hasOwn(x, "oracle"), false);
  assert.equal(x.input.provenance.properLaw, true);
  const input = mdomainInput(x.input);
  assert.deepEqual(input.states, x.input.states);
  assert.deepEqual(input.masses, x.input.masses);
  assert.deepEqual(JSON.parse(JSON.stringify(x)), x);
}

test("all twelve common law/tau/weight requests match independent R scientific inputs", () => {
  let count = 0;
  for (const law of ["aligned", "crossed"] as const) for (let tauIndex = 0; tauIndex <= 2; tauIndex++) {
    for (let weightIndex = 0; weightIndex <= 1; weightIndex++) {
      const request = mdomainExample("common", { law, tauIndex, weightIndex });
      validRequest(request);
      const name = `common-${law}-${["low", "boundary", "ordinary"][tauIndex]}-${weightIndex ? "one-heavy" : "equal"}`;
      assert.deepEqual(mathematics(request), mathematics(oracle(name)));
      assert.equal(request.decision.t, null);
      count++;
    }
  }
  assert.equal(count, 12);
});

test("all twelve separability requests match R, with guards retained at zero loss weight", () => {
  let count = 0;
  for (const couplingIndex of [0, 1, 10]) for (const zeroWeight of [false, true]) {
    for (const protectedMode of [false, true]) {
      const request = mdomainExample("separable", { couplingIndex, zeroWeight, protected: protectedMode });
      validRequest(request);
      const name = `separable-${couplingIndex === 0 ? "disjoint" : couplingIndex === 1 ? "independent" : "coincident"}-${zeroWeight ? "one-zero" : "equal"}-guard-${protectedMode ? "on" : "off"}`;
      assert.deepEqual(mathematics(request), mathematics(oracle(name)));
      assert.deepEqual(request.decision.weights, zeroWeight ? ["0", "1"] : ["1/2", "1/2"]);
      assert.deepEqual(request.decision.t, protectedMode ? ["0", "0"] : null);
      count++;
    }
  }
  assert.equal(count, 12);
});

test("eleven coupling controls are valid complete laws; the four preset inputs match R", () => {
  for (let couplingIndex = 0; couplingIndex <= 10; couplingIndex++) {
    const request = mdomainExample("dependence", { couplingIndex });
    validRequest(request);
    assert.deepEqual(request.input.stateIds, ["++", "-+", "+-", "--"]);
    assert.equal(request.input.states.length, 4);
    assert.deepEqual(request.decision.weights, ["1/2", "1/2"]);
    assert.deepEqual(request.decision.t, ["0", "0"]);
  }
  for (const [couplingIndex, name] of [[0, "disjoint"], [1, "independent"], [5, "at-cap-boundary"], [10, "coincident"]] as const) {
    assert.deepEqual(mathematics(mdomainExample("dependence", { couplingIndex })), mathematics(oracle(`dependence-${name}`)));
  }
  assert.deepEqual(mdomainExample("dependence", { couplingIndex: 5 }).input.masses, ["17/20", "1/20", "1/20", "1/20"]);
});

test("all twenty-one resolution control combinations match independent R laws and policies", () => {
  let count = 0;
  for (let noiseIndex = 0; noiseIndex <= 2; noiseIndex++) for (let budgetIndex = 0; budgetIndex <= 6; budgetIndex++) {
    const request = mdomainExample("resolution", { noiseIndex, budgetIndex });
    validRequest(request);
    assert.deepEqual(mathematics(request), mathematics(oracle(`resolution-k${noiseIndex}-a${budgetIndex}`)));
    assert.deepEqual(request.input.stateIds, ["s1", "s2", "s3"]);
    count++;
  }
  assert.equal(count, 21);
});

test("factory defaults are the complete documented presets, without computed results", () => {
  assert.deepEqual(mdomainExample("common"), mdomainExample("common", { law: "crossed", tauIndex: 2, weightIndex: 0 }));
  assert.deepEqual(mdomainExample("separable"), mdomainExample("separable", { couplingIndex: 10, zeroWeight: false, protected: false }));
  assert.deepEqual(mdomainExample("dependence"), mdomainExample("dependence", { couplingIndex: 10 }));
  assert.deepEqual(mdomainExample("resolution"), mdomainExample("resolution", { noiseIndex: 1, budgetIndex: 3 }));
});

test("returned requests own every mutable branch and do not mutate the controls", () => {
  const settings = Object.freeze({ couplingIndex: 5 });
  const before = mdomainExample("dependence", settings);
  const changed = mdomainExample("dependence", settings);
  changed.input.states[0][0][0] = -99;
  changed.input.masses[0] = "0";
  changed.input.targets[0].equalityClasses[0] = "changed";
  changed.input.domainIds[0] = "changed";
  changed.decision.weights[0] = "0";
  changed.family.banks[0].columns[0].grades[0] = 99;
  assert.deepEqual(mdomainExample("dependence", settings), before);
  assert.deepEqual(settings, { couplingIndex: 5 });
});

test("changing a decision preserves the law; changing noise constructs a new complete law", () => {
  const a = mdomainExample("common", { law: "crossed", tauIndex: 0, weightIndex: 0 });
  const b = mdomainExample("common", { law: "crossed", tauIndex: 2, weightIndex: 1 });
  assert.deepEqual(a.input, b.input);
  const c = mdomainExample("resolution", { noiseIndex: 1, budgetIndex: 0 });
  const d = mdomainExample("resolution", { noiseIndex: 1, budgetIndex: 6 });
  assert.deepEqual(c.input, d.input);
  assert.notDeepEqual(c.input, mdomainExample("resolution", { noiseIndex: 2, budgetIndex: 0 }).input);
});

test("factory rejects unknown controls, malformed indexes and coercible nonbooleans with typed fields", () => {
  const run = mdomainExample as unknown as (kind: unknown, options?: unknown) => MdomainFixture;
  const invalid = (kind: unknown, options: unknown, field: string): void => {
    assert.throws(() => run(kind, options), (error: unknown) => error instanceof MdomainError &&
      error.code === "mdomainInputInvalid" && error.field === field);
  };
  for (const kind of ["", "saved40", "__proto__", null, 7]) invalid(kind, undefined, "kind");
  for (const options of [null, [], 1, "c=1", new Date()]) invalid("dependence", options, "options");
  for (const value of [-1, 11, 0.5, NaN, Infinity, "1", null]) invalid("dependence", { couplingIndex: value }, "options.couplingIndex");
  for (const value of [2, 3, 9]) invalid("separable", { couplingIndex: value }, "options.couplingIndex");
  for (const value of [1, "true", null]) {
    invalid("separable", { zeroWeight: value }, "options.zeroWeight");
    invalid("separable", { protected: value }, "options.protected");
  }
  invalid("common", { law: "other" }, "options.law");
  invalid("common", { tau: "1/4" }, "options.tau");
  invalid("dependence", { budgetIndex: 0 }, "options.budgetIndex");
  invalid("resolution", { t: "0" }, "options.t");
  for (const options of [{ tauIndex: 3 }, { tauIndex: 1.5 }]) invalid("common", options, "options.tauIndex");
  invalid("common", { weightIndex: 2 }, "options.weightIndex");
  invalid("resolution", { noiseIndex: 3 }, "options.noiseIndex");
  for (const value of [7, -1]) invalid("resolution", { budgetIndex: value }, "options.budgetIndex");
  invalid("dependence", { [Symbol("hidden")]: 1 }, "options");
  const hidden = Object.defineProperty({}, "unknown", { value: 1 });
  invalid("dependence", hidden, "options.unknown");
  let read = false;
  invalid("dependence", { get couplingIndex() { read = true; return 5; } }, "options.couplingIndex");
  assert.equal(read, false);
});

test("runtime factories do not import oracle fixtures or scientific result files", () => {
  const source = readFileSync(resolve(root, "engine/src/mdomain/examples.ts"), "utf8");
  assert.doesNotMatch(source, /(?:from|import\()\s*["'][^"']*(?:verification|golden|r-export|\.json)/);
});
