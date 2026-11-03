// The browser MIP (src/mip.ts) with highs-js 1.15.4, and the built solver bundles (js/bundles/solver.js,
// js/bundles/solver-node.mjs). The bundle tests need `npm run build` first, as the pr-core smoke tests do.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import loadHighs from "highs";
import {
  MIP_LABEL, createMipSolver, gradeFromZ, mipColumn, mipCosts, mipModelData, mipOffset, mipStatusName,
  type HighsLike, type HighsModelLike, type MipModelData, type MipResult,
} from "../src/mip.ts";
import { errorArray, type ErrorArray } from "../src/pairwise.ts";
import { canonicalGrade, familySize, weakRelation } from "../src/report.ts";
import { evaluateReport, relaxedPairRisk } from "../src/risk.ts";
import { exactOptimum, prepare, tauPath, type ExactOptimum, type TauPath } from "../src/optimize.ts";
import { normals, rng } from "../src/random.ts";

const root = path.resolve(import.meta.dirname, "../..");
const highs = (await loadHighs()) as unknown as HighsLike;

// The six sites with scores A and B (independent normals, SD .20), as in multi.test.ts.
const SIX_A = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];
const SIX_B = [0.7, 0.4, 0.9, 0.6, -0.5, -0.7];
const E1 = errorArray(SIX_A, 0.2);
const E2 = errorArray(SIX_A.map((a, i) => [a, SIX_B[i]]), 0.2, { criteria: ["score_A", "score_B"] });
const HALF = [0.5, 0.5];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const sameGrade = (a: readonly number[] | null, b: readonly number[]) => a !== null && a.join() === b.join();

function exact(E: ErrorArray, tau: number, w?: number[]): ExactOptimum {
  const x = exactOptimum(E, { tau, w });
  assert.equal(x.empty, false);
  return x as ExactOptimum;
}

/** The checks every optimal result must pass against the exact optimum of 𝒜_n. */
function assertMatchesExact(r: MipResult, x: ExactOptimum, E: ErrorArray, tau: number, w: number[] | undefined, what: string) {
  assert.equal(r.status, "optimal", what);
  assert.equal(r.statusCode, 7, what);
  assert.equal(r.label, MIP_LABEL, what);
  assert.ok(x.grades.some((g) => sameGrade(r.grade, g)), `${what}: ${r.grade} is not among the exact optima ${JSON.stringify(x.grades)}`);
  assert.ok(r.upper !== null && Math.abs(r.upper - x.risk) <= 1e-12, `${what}: upper ${r.upper} vs exact ${x.risk}`);
  const ev = evaluateReport(r.grade as number[], E, { tau, w });
  assert.ok(Math.abs((r.upper as number) - ev.risk) <= 1e-12, `${what}: upper ${r.upper} vs evaluateReport ${ev.risk}`);
  assert.ok(r.lower !== null && r.lower <= (r.upper as number), `${what}: lower ${r.lower} > upper ${r.upper}`);
  assert.ok(r.gap !== null && r.gap >= 0 && r.gap <= 1e-12, `${what}: gap ${r.gap}`);
  assert.equal(r.family.name, x.family.name, what);
  assert.equal(r.family.size, x.family.size, what);
  assert.ok(r.seconds > 0, what);
}

/** Random normal problem: means N(0, scale²), SDs .1 … .5, K criteria. */
function randomNormal(seed: number, n: number, K = 1, scale = 0.6): ErrorArray {
  const z = normals(seed, n * K);
  const u = rng(seed + 7919);
  const means = Array.from({ length: n }, (_, i) => Array.from({ length: K }, (_, k) => scale * z[i * K + k]));
  const sds = Array.from({ length: n }, () => Array.from({ length: K }, () => 0.1 + 0.4 * u()));
  return errorArray(means, sds);
}

/** Random tournament: e_ij uniform, e_ji = 1 − e_ij (cyclic preferences are common, so the LP is fractional). */
function randomTournament(seed: number, n: number): ErrorArray {
  const u = rng(seed);
  const e = Array.from({ length: n }, () => new Array<number>(n).fill(Number.NaN));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      e[i][j] = u();
      e[j][i] = 1 - e[i][j];
    }
  }
  return { ids: Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)), criteria: ["k1"], e: [e] };
}

// ---------------------------------------------------------------------------------------------------------
// Model pieces

test("model shape: n(n − 1) binary columns, C(n, 2) completeness and n(n − 1)(n − 2) transitivity rows", () => {
  for (const n of [2, 3, 6, 10]) {
    const d = mipModelData(n, highs.infinity);
    assert.equal(d.numCols, n * (n - 1));
    assert.equal(d.numRows, (n * (n - 1)) / 2 + n * (n - 1) * (n - 2));
    assert.equal(d.matrix.starts[d.numRows], d.matrix.indices.length);
    assert.ok(d.integrality.every((t) => t === 1) && d.colLower.every((x) => x === 0) && d.colUpper.every((x) => x === 1));
    // columns are a bijection onto 0 … n(n − 1) − 1
    const cols = new Set<number>();
    for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) if (a !== b) cols.add(mipColumn(n, a, b));
    assert.equal(cols.size, d.numCols);
    assert.equal(Math.max(...cols), d.numCols - 1);
  }
  assert.throws(() => mipModelData(1, highs.infinity), RangeError);
});

/** Row activities of a 0/1 column vector against the model rows. */
function feasible(d: MipModelData, x: ArrayLike<number>): boolean {
  for (let r = 0; r < d.numRows; r += 1) {
    let s = 0;
    for (let k = d.matrix.starts[r]; k < d.matrix.starts[r + 1]; k += 1) s += d.matrix.values[k] * x[d.matrix.indices[k]];
    if (s < d.rowLower[r] || s > d.rowUpper[r]) return false;
  }
  return true;
}

/** The z column vector of a report. */
function zColumns(g: readonly number[]): Float64Array {
  const n = g.length;
  const { z } = weakRelation(g);
  const x = new Float64Array(n * (n - 1));
  for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) if (a !== b) x[mipColumn(n, a, b)] = z[a][b];
  return x;
}

test("the feasible z are exactly the 75 reports on 4 units, and gradeFromZ inverts weakRelation", () => {
  const n = 4;
  const d = mipModelData(n, highs.infinity);
  const seen = new Set<string>();
  for (let mask = 0; mask < 2 ** (n * (n - 1)); mask += 1) {
    const x = Float64Array.from({ length: n * (n - 1) }, (_, k) => (mask >> k) & 1);
    if (!feasible(d, x)) {
      assert.throws(() => gradeFromZ(x, n), /not a weak order/);
      continue;
    }
    const g = gradeFromZ(x, n);
    assert.deepEqual(Array.from(zColumns(g)), Array.from(x));
    assert.deepEqual(g, canonicalGrade(g));
    seen.add(g.join());
  }
  assert.equal(seen.size, 75);
});

test("objective identity: τ + (C + Σ c·z)/M equals evaluateReport risk for every report on 5 units (K = 2)", () => {
  const E = randomNormal(11, 5, 2);
  const w = [0.3, 0.7];
  const P = prepare(E, w);
  for (const tau of [0.1, 0.35]) {
    const c = mipCosts(P.ebar, 5, tau);
    const C = mipOffset(P.ebar, 5, tau);
    let count = 0;
    const g = new Array<number>(5).fill(1);
    for (;;) {
      if (new Set(g).size === Math.max(...g)) {
        const x = zColumns(g);
        let obj = 0;
        for (let k = 0; k < x.length; k += 1) obj += c[k] * x[k];
        const risk = evaluateReport(g, E, { tau, w }).risk;
        assert.ok(Math.abs(tau + (C + obj) / P.M - risk) <= 1e-14, `${g}`);
        count += 1;
      }
      let q = 4;
      while (q >= 0 && g[q] === 5) g[q--] = 1;
      if (q < 0) break;
      g[q] += 1;
    }
    assert.equal(count, 541);
  }
});

test("status names: 7 → optimal, 13 → time limit, others the HiGHS name in lower case", () => {
  assert.equal(mipStatusName(7), "optimal");
  assert.equal(mipStatusName(13), "time limit");
  assert.equal(mipStatusName(8), "infeasible");
  assert.equal(mipStatusName(14), "iteration limit reached");
  assert.equal(mipStatusName(17), "interrupted by user");
  assert.equal(mipStatusName(99), "highs model status 99");
});

// ---------------------------------------------------------------------------------------------------------
// Agreement with exact enumeration

test("six sites, one score: τ = .15, .25, .40 equal exactOptimum over all 4,683 reports", () => {
  const solver = createMipSolver(highs);
  const want: Record<number, string> = { 0.15: "1,1,2,2,3,4", 0.25: "1,2,3,3,4,5", 0.4: "1,2,3,4,5,6" };
  for (const tau of [0.15, 0.25, 0.4]) {
    const r = solver.solve(E1, { tau });
    const x = exact(E1, tau);
    assertMatchesExact(r, x, E1, tau, undefined, `τ = ${tau}`);
    assert.equal((r.grade as number[]).join(), want[tau]);
    assert.equal(r.family.size, 4683);
  }
  solver.dispose();
});

test("six sites, two scores, w = (1/2, 1/2): τ = .15, .25, .40 equal exactOptimum", () => {
  const solver = createMipSolver(highs);
  for (const tau of [0.15, 0.25, 0.4]) {
    const r = solver.solve(E2, { tau, w: HALF });
    assertMatchesExact(r, exact(E2, tau, HALF), E2, tau, HALF, `τ = ${tau}`);
  }
  solver.dispose();
});

test("random problems on 7 units (normal laws, K = 1, 2, 3; tournaments) equal enumeration of all 47,293 reports", (t) => {
  const solver = createMipSolver(highs);
  let solves = 0;
  const ms: number[] = [];
  const cases: { E: ErrorArray; w?: number[]; name: string }[] = [];
  for (let s = 1; s <= 8; s += 1) cases.push({ E: randomNormal(100 + s, 7), name: `normal ${s}` });
  for (let s = 1; s <= 3; s += 1) {
    const u = rng(500 + s);
    const a = u();
    cases.push({ E: randomNormal(200 + s, 7, 2), w: [a, 1 - a], name: `normal K = 2, ${s}` });
    const b = [u(), u(), u()];
    const sum = b[0] + b[1] + b[2];
    cases.push({ E: randomNormal(300 + s, 7, 3), w: [b[0] / sum, b[1] / sum, 1 - b[0] / sum - b[1] / sum], name: `normal K = 3, ${s}` });
  }
  for (let s = 1; s <= 4; s += 1) cases.push({ E: randomTournament(400 + s, 7), name: `tournament ${s}` });
  for (const { E, w, name } of cases) {
    for (const tau of [0.1, 0.2, 0.3, 0.45]) {
      const r = solver.solve(E, { tau, w });
      ms.push(r.seconds * 1000);
      assertMatchesExact(r, exact(E, tau, w), E, tau, w, `${name}, τ = ${tau}`);
      solves += 1;
    }
  }
  assert.equal(solves, 72);
  assert.equal(solver.builds, cases.length);
  t.diagnostic(`n = 7: ${solves} solves, median ${median(ms).toFixed(1)} ms per solve`);
  solver.dispose();
});

test("near ties at τ-path breakpoints: the solver (gaps 0) finds the optimum on each side and an optimum at the tie", () => {
  // At a breakpoint τ* two reports tie; at τ* ± 1e-5 one of them wins by 1e-5 per extra disclosed pair on the
  // objective scale (below the HiGHS default mip_rel_gap 1e-4 times |objective|, above its 1e-6 feasibility
  // tolerance), so a solver with the default gaps would be allowed to stop at the runner-up.
  const solver = createMipSolver(highs);
  let checked = 0;
  for (const [E, w] of [
    [E1, undefined],
    [E2, HALF],
  ] as [ErrorArray, number[] | undefined][]) {
    const tp = tauPath(E, { w });
    assert.equal(tp.empty, false);
    const path = (tp as TauPath).intervals;
    for (let q = 1; q < path.length; q += 1) {
      const star = path[q].tauFrom;
      if (star < 0.01) continue;
      const below = path[q - 1].grade;
      const above = path[q].grade;
      for (const [tau, winner, loser] of [
        [star - 1e-5, below, above],
        [star + 1e-5, above, below],
      ] as [number, number[], number[]][]) {
        const x = exact(E, tau, w);
        assert.deepEqual(x.grades, [winner], `unique optimum at τ = ${tau}`);
        const margin = evaluateReport(loser, E, { tau, w }).risk - x.risk;
        assert.ok(margin > 1e-8 && margin < 1e-5, `the runner-up is close: margin ${margin}`);
        const r = solver.solve(E, { tau, w });
        assertMatchesExact(r, x, E, tau, w, `τ* ${star} ${tau > star ? "+" : "−"} 1e-5`);
        assert.ok(sameGrade(r.grade, winner));
        checked += 1;
      }
      const tie = exact(E, star, w);
      assert.ok(tie.grades.length >= 2, `a tie at τ* = ${star}`);
      assertMatchesExact(solver.solve(E, { tau: star, w }), tie, E, star, w, `τ* = ${star}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 18, `${checked} near-tie checks`);
  solver.dispose();
});

test("spike problems n = 10, 20, 30 (Step 1.6, τ = .25) agree with postrank 1.1.0 (same grade and risk)", () => {
  // copies of the Step 1.6 spike files spikes/solver/problem-n{10,20,30}.json and postrank-results.json
  const dir = path.join(import.meta.dirname, "fixtures");
  const ref = JSON.parse(fs.readFileSync(path.join(dir, "postrank-results.json"), "utf8")) as { n: number; grade: number[]; risk: number }[];
  const solver = createMipSolver(highs);
  for (const n of [10, 20, 30]) {
    const P = JSON.parse(fs.readFileSync(path.join(dir, `problem-n${n}.json`), "utf8")) as { tau: number; e: number[][] };
    const E: ErrorArray = { ids: P.e.map((_, i) => `u${i + 1}`), criteria: ["score"], e: [P.e] };
    const r = solver.solve(E, { tau: P.tau });
    const want = ref.find((x) => x.n === n) as { grade: number[]; risk: number };
    assert.equal(r.status, "optimal");
    assert.deepEqual(r.grade, canonicalGrade(want.grade), `n = ${n}`);
    // the package risk is stored with 15 significant digits
    assert.ok(Math.abs((r.upper as number) - want.risk) <= 1e-14, `n = ${n}: ${r.upper} vs ${want.risk}`);
    assert.ok(Math.abs((r.upper as number) - evaluateReport(r.grade as number[], E, { tau: P.tau }).risk) <= 1e-12);
    assert.ok(relaxedPairRisk(E, { tau: P.tau }) <= (r.upper as number) + 1e-15);
    // family.size is a number up to 2^53 and a decimal string above (E-12), so the result is JSON-serializable
    const size = familySize(n, { kind: "all" });
    assert.equal(r.family.size, typeof size === "bigint" ? size.toString() : size);
    assert.equal(r.family.sizeExact, BigInt(size));
    assert.doesNotThrow(() => JSON.stringify(r));
  }
  solver.dispose();
});

// ---------------------------------------------------------------------------------------------------------
// Persistent model (CONTRACT 6.3 acceptance test)

/** highs wrapped so that every model call is recorded; only the methods of HighsModelLike exist. */
function spyHighs() {
  const log = { creates: 0, calls: [] as string[], models: [] as unknown[] };
  const spy: HighsLike = {
    infinity: highs.infinity,
    createModel(data: MipModelData): HighsModelLike {
      log.creates += 1;
      const m = highs.createModel(data);
      log.models.push(m);
      const rec = (name: string) => log.calls.push(name);
      return {
        options: {
          set: (v) => {
            rec(`options.set(${Object.keys(v).join(",")})`);
            return m.options.set(v);
          },
        },
        info: { get: (k) => m.info.get(k) },
        changeColsCost: (s, c) => {
          rec("changeColsCost");
          return m.changeColsCost(s, c);
        },
        zeroAllClocks: () => {
          rec("zeroAllClocks");
          return m.zeroAllClocks();
        },
        run: () => {
          rec("run");
          return m.run();
        },
        getModelStatus: () => m.getModelStatus(),
        getObjectiveValue: () => m.getObjectiveValue(),
        getSolution: () => m.getSolution(),
        dispose: () => {
          rec("dispose");
          m.dispose();
        },
      };
    },
  };
  return { spy, log };
}

/** Detached model data of a real highs-js model (getLp). */
type Lp = { colCost: Float64Array; colLower: Float64Array; colUpper: Float64Array; rowLower: Float64Array; rowUpper: Float64Array; integrality: Int32Array; matrix: { starts: Int32Array; indices: Int32Array; values: Float64Array } };
const lpOf = (m: unknown) => (m as { getLp(): Lp }).getLp();

test("persistent model: a τ change reuses the model, changes only the column costs, and equals a fresh model", (t) => {
  for (const [name, E, w, taus] of [
    ["six sites", E1, undefined, [0.25, 0.15, 0.4, 0.25, 0.2, 0.1888]],
    ["six sites, two scores", E2, HALF, [0.25, 0.4, 0.15]],
    ["normal, n = 14", randomNormal(901, 14, 1, 0.4), undefined, [0.25, 0.1, 0.45, 0.3]],
    ["tournament, n = 9", randomTournament(902, 9), undefined, [0.3, 0.45, 0.2]],
  ] as [string, ErrorArray, number[] | undefined, number[]][]) {
    const { spy, log } = spyHighs();
    const solver = createMipSolver(spy);
    const n = E.e[0].length;
    const P = prepare(E, w);
    let before: Lp | null = null;
    const reusedMs: number[] = [];
    taus.forEach((tau, step) => {
      const callsBefore = log.calls.length;
      const r = solver.solve(E, { tau, w });
      const calls = log.calls.slice(callsBefore);
      assert.equal(r.reused, step > 0, `${name}: reused at step ${step}`);
      if (step > 0) {
        reusedMs.push(r.seconds * 1000);
        // the only model change between solves is the objective
        assert.deepEqual(calls, ["changeColsCost", "options.set(time_limit)", "zeroAllClocks", "run"], name);
      }
      // the native model holds the new costs and unchanged constraints
      const lp = lpOf(log.models[0]);
      assert.deepEqual(Array.from(lp.colCost), Array.from(mipCosts(P.ebar, n, tau)), `${name}: costs at τ = ${tau}`);
      if (before) {
        for (const key of ["colLower", "colUpper", "rowLower", "rowUpper", "integrality"] as const) {
          assert.deepEqual(Array.from(lp[key]), Array.from(before[key]), `${name}: ${key}`);
        }
        for (const key of ["starts", "indices", "values"] as const) {
          assert.deepEqual(Array.from(lp.matrix[key]), Array.from(before.matrix[key]), `${name}: matrix ${key}`);
        }
      }
      before = lp;
      // the same answer as a fresh model
      const fresh = createMipSolver(highs);
      const f = fresh.solve(E, { tau, w });
      fresh.dispose();
      assert.equal(f.reused, false);
      for (const key of ["status", "grade", "objective", "bound", "upper", "lower", "gap"] as const) {
        assert.deepEqual(r[key], f[key], `${name}, τ = ${tau}: ${key} (persistent ${JSON.stringify(r[key])}, fresh ${JSON.stringify(f[key])})`);
      }
      if (n <= 8) assertMatchesExact(r, exact(E, tau, w), E, tau, w, `${name}, τ = ${tau}`);
    });
    assert.equal(log.creates, 1, `${name}: one model for ${taus.length} values of τ`);
    assert.equal(solver.builds, 1);
    t.diagnostic(`${name}: τ change on the persistent model, median ${median(reusedMs).toFixed(1)} ms`);
    solver.dispose();
    assert.equal(log.calls.at(-1), "dispose");
  }
});

test("persistent model: new E or new w builds a new model (the old one is disposed); same E and w reuse it", () => {
  const { spy, log } = spyHighs();
  const solver = createMipSolver(spy);
  assert.equal(solver.solve(E2, { tau: 0.25, w: HALF }).reused, false);
  assert.equal(solver.solve(E2, { tau: 0.3, w: [0.5, 0.5] }).reused, true, "equal weights in a new array");
  assert.equal(solver.solve(E2, { tau: 0.3, w: [0.4, 0.6] }).reused, false, "new weights");
  assert.equal(solver.solve(E1, { tau: 0.3 }).reused, false, "new E");
  assert.equal(solver.solve(errorArray(SIX_A, 0.2), { tau: 0.2 }).reused, true, "an equal E in a new object");
  assert.equal(solver.solve(E1, { tau: 0.2, timeLimit: 5 }).reused, true, "a new time limit");
  assert.equal(log.creates, 3);
  assert.equal(log.calls.filter((c) => c === "dispose").length, 2);
  solver.dispose();
  solver.dispose();
  assert.equal(log.calls.filter((c) => c === "dispose").length, 3, "dispose is idempotent");
  assert.equal(solver.solve(E1, { tau: 0.2 }).reused, false, "usable after dispose");
  solver.dispose();
});

// ---------------------------------------------------------------------------------------------------------
// Limits, errors, timings

test("time limit: a tiny limit reports 'time limit' honestly (no optimal label); the next solve resets the clock", () => {
  const E = randomNormal(77, 30, 1, 1);
  const solver = createMipSolver(highs);
  const r = solver.solve(E, { tau: 0.25, timeLimit: 1e-6 });
  assert.equal(r.status, "time limit");
  assert.equal(r.statusCode, 13);
  assert.notEqual(r.status, "optimal");
  assert.equal(r.label, null);
  assert.equal(r.timeLimit, 1e-6);
  if (r.grade === null) {
    assert.equal(r.upper, null);
    assert.equal(r.objective, null);
    assert.equal(r.gap, null);
    assert.equal(r.evaluation, null);
  } else {
    assert.ok(Math.abs((r.upper as number) - evaluateReport(r.grade, E, { tau: 0.25 }).risk) <= 1e-12);
    if (r.lower !== null) assert.ok(r.lower <= (r.upper as number) && (r.gap as number) >= 0);
  }
  if (r.lower === null) assert.equal(r.gap, null);
  const again = solver.solve(E, { tau: 0.25 });
  assert.equal(again.reused, true);
  assert.equal(again.status, "optimal");
  assert.equal(again.label, MIP_LABEL);
  assert.ok((again.gap as number) <= 1e-12);
  solver.dispose();
});

test("input checks: τ outside (0, 1/2], timeLimit ≤ 0, missing weights for K = 2 and one unit all throw", () => {
  const solver = createMipSolver(highs);
  for (const tau of [0, 0.51, Number.NaN]) assert.throws(() => solver.solve(E1, { tau }), RangeError);
  assert.throws(() => solver.solve(E1, { tau: 0.2, timeLimit: 0 }), RangeError);
  assert.throws(() => solver.solve(E1, { tau: 0.2, timeLimit: -1 }), RangeError);
  assert.throws(() => solver.solve(E2, { tau: 0.2 }), RangeError);
  assert.throws(() => solver.solve(E2, { tau: 0.2, w: [0.5, 0.6] }), RangeError);
  assert.throws(() => solver.solve({ ids: ["A"], criteria: ["k1"], e: [[[Number.NaN]]] }, { tau: 0.2 }), RangeError);
  // options are objects and unknown keys throw (E-2, E-21)
  assert.throws(() => solver.solve(E1, 0.2 as never), /mipSolve: options object expected: \{tau, w, timeLimit\}/);
  assert.throws(() => solver.solve(E1, { tau: 0.2, family: { kind: "atMost", G: 3 } } as never), /mipSolve: unknown option "family"/);
  assert.throws(() => createMipSolver(highs, { gap: 0 } as never), /createMipSolver: unknown option "gap"/);
  assert.equal(solver.builds, 0);
  // n = 2: no transitivity rows; the solver states the pair or withholds it as the isolated-pair rule does
  const E = errorArray([0.3, 0], 0.2);
  assert.deepEqual(solver.solve(E, { tau: 0.2 }).grade, [1, 2]);
  assert.deepEqual(solver.solve(E, { tau: 0.05 }).grade, [1, 1]);
  solver.dispose();
});

test("timings, n = 10, 20, 25 (normal laws, τ = .25 then .15 on the persistent model)", (t) => {
  const solver = createMipSolver(highs);
  for (const [n, seed] of [
    [10, 1010],
    [20, 1020],
    [25, 1025],
  ]) {
    const E = randomNormal(seed, n, 1, 1);
    const first = solver.solve(E, { tau: 0.25 });
    const moved = solver.solve(E, { tau: 0.15 });
    for (const r of [first, moved]) {
      assert.equal(r.status, "optimal");
      assert.ok((r.gap as number) <= 1e-12);
      assert.ok(relaxedPairRisk(E, { tau: r.tau }) <= (r.upper as number) + 1e-15);
      assert.ok(Math.abs((r.upper as number) - (r.evaluation as { risk: number }).risk) <= 1e-12);
    }
    t.diagnostic(
      `n = ${n}: first solve (build + run) ${(first.seconds * 1000).toFixed(1)} ms, G = ${first.G}, nodes ${first.nodes}; ` +
        `τ change ${(moved.seconds * 1000).toFixed(1)} ms, G = ${moved.G}`,
    );
  }
  solver.dispose();
});

// ---------------------------------------------------------------------------------------------------------
// Built bundles

const bundles = path.join(root, "js", "bundles");
const wasmB64 = fs.readFileSync(path.join(import.meta.dirname, "..", "node_modules", "highs", "build", "highs.wasm")).toString("base64");

test("js/pr-core.js and js/pr-core.umd.js contain no solver; solver.js inlines the wasm once", () => {
  for (const f of ["pr-core.js", "pr-core.umd.js"]) {
    const code = fs.readFileSync(path.join(root, "js", f), "utf8");
    for (const word of ["WebAssembly", "instantiateWasm", "changeColsCost", "mipSolve", wasmB64.slice(0, 64)]) {
      assert.ok(!code.includes(word), `${f} contains ${word.slice(0, 20)}`);
    }
  }
  for (const f of ["solver.js", "solver-node.mjs"]) {
    const code = fs.readFileSync(path.join(bundles, f), "utf8");
    assert.equal(code.split(wasmB64).length, 2, `${f}: the wasm base64 appears exactly once`);
    assert.match(code, /highs-js 1\.15\.4/);
    assert.match(code, /MIT License/);
  }
  const browser = fs.readFileSync(path.join(bundles, "solver.js"), "utf8");
  assert.match(browser, /PRX_SOLVER/);
  assert.match(browser, /createObjectURL/);
  assert.match(browser, /instantiateWasm/);
});

test("js/bundles/solver-node.mjs: mipSolve after import equals the source solver", async () => {
  const mod = (await import(path.join(bundles, "solver-node.mjs"))) as {
    mipSolve: (E: ErrorArray, o: { tau: number; w?: number[]; timeLimit?: number }) => MipResult;
    ready: Promise<{ highs: string }>;
    HIGHS_VERSION: string;
  };
  assert.deepEqual(await mod.ready, { highs: "1.15.4" });
  assert.equal(mod.HIGHS_VERSION, "1.15.4");
  const solver = createMipSolver(highs);
  for (const [E, w] of [
    [E1, undefined],
    [E2, HALF],
  ] as [ErrorArray, number[] | undefined][]) {
    for (const tau of [0.15, 0.25, 0.4]) {
      const r = mod.mipSolve(E, { tau, w });
      const s = solver.solve(E, { tau, w });
      for (const key of ["status", "grade", "upper", "lower", "gap", "label", "family"] as const) assert.deepEqual(r[key], s[key], key);
      assertMatchesExact(r, exact(E, tau, w), E, tau, w, `bundle τ = ${tau}`);
    }
  }
  assert.equal((await mod.mipSolve(E1, { tau: 0.2 })).status, "optimal", "await works on the direct result");
  assert.throws(() => mod.mipSolve(E1, { tau: 0.6 }), RangeError);
  solver.dispose();
});

/**
 * Runs js/bundles/solver.js in a vm context with a minimal browser: Blob, URL.createObjectURL and a Worker that
 * evaluates the blob text in its own context (self, WorkerGlobalScope, postMessage with structured clones).
 */
function loadBrowserBundle() {
  const blobs = new Map<string, string>();
  const created: string[] = [];
  const workers: { onerror: ((ev: unknown) => void) | null; terminated: boolean }[] = [];
  class FakeBlob {
    text: string;
    constructor(parts: string[], _opts?: unknown) {
      this.text = parts.join("");
    }
  }
  const fakeURL = {
    createObjectURL(b: FakeBlob) {
      const url = `blob:null/${blobs.size + 1}`;
      blobs.set(url, b.text);
      created.push(url);
      return url;
    },
    revokeObjectURL(url: string) {
      blobs.delete(url);
    },
  };
  class FakeWorker {
    onmessage: ((ev: { data: unknown }) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    terminated = false;
    private ctx: vm.Context;
    constructor(url: string) {
      const src = blobs.get(url);
      if (src === undefined) throw new Error(`no blob at ${url}`);
      workers.push(this);
      const g: Record<string, unknown> = {
        WorkerGlobalScope: function WorkerGlobalScope() {},
        location: { href: url },
        performance,
        atob,
        console,
        postMessage: (data: unknown) => setImmediate(() => this.onmessage?.({ data: structuredClone(data) })),
      };
      g.self = g;
      this.ctx = vm.createContext(g);
      vm.runInContext(src, this.ctx);
    }
    postMessage(data: unknown) {
      const ctx = this.ctx as { onmessage?: (ev: { data: unknown }) => void };
      if (!this.terminated) setImmediate(() => ctx.onmessage?.({ data: structuredClone(data) }));
    }
    terminate() {
      this.terminated = true;
    }
  }
  const window: Record<string, unknown> = {};
  const page = vm.createContext({ window, Blob: FakeBlob, URL: fakeURL, Worker: FakeWorker, Map, Promise, RangeError, TypeError, Error });
  const code = fs.readFileSync(path.join(bundles, "solver.js"), "utf8");
  vm.runInContext(code, page);
  return {
    api: window.PRX_SOLVER as { mipSolve: (E: ErrorArray, o: object) => Promise<MipResult>; ready: Promise<{ highs: string; initSeconds: number }> },
    created,
    blobs,
    workers,
    window,
    /** load the bundle a second time into the same page */
    reload: () => vm.runInContext(code, page),
  };
}

test("js/bundles/solver.js: window.PRX_SOLVER = { mipSolve, ready } runs the solver in a blob-URL Worker", async () => {
  const { api, created, blobs } = loadBrowserBundle();
  assert.deepEqual(Object.keys(api).sort(), ["mipSolve", "ready"]);
  assert.equal(created.length, 0, "no Worker before first use");
  const info = await api.ready;
  assert.equal(info.highs, "1.15.4");
  assert.equal(api.ready, api.ready, "ready is one promise");
  assert.equal(created.length, 1);
  assert.equal(blobs.size, 0, "the blob URL is revoked once the Worker has started");
  const results: MipResult[] = [];
  for (const tau of [0.15, 0.25, 0.4]) {
    const r = await api.mipSolve(E1, { tau });
    assertMatchesExact(r, exact(E1, tau), E1, tau, undefined, `browser bundle τ = ${tau}`);
    results.push(r);
  }
  assert.deepEqual(results.map((r) => r.reused), [false, true, true], "the Worker keeps the persistent model");
  const two = await Promise.all([0.2, 0.3].map((tau) => api.mipSolve(E2, { tau, w: HALF })));
  two.forEach((r, q) => assertMatchesExact(r, exact(E2, [0.2, 0.3][q], HALF), E2, [0.2, 0.3][q], HALF, "concurrent requests"));
  await assert.rejects(api.mipSolve(E1, { tau: 0.9 }), (err: Error) => err.name === "RangeError" && /tau must lie/.test(err.message));
  const tl = await api.mipSolve(randomNormal(77, 30, 1, 1), { tau: 0.25, timeLimit: 1e-6 });
  assert.equal(tl.status, "time limit");
  assert.equal(tl.label, null);
  assert.equal(created.length, 1, "one Worker for every request");
});

test("js/bundles/solver.js: a second load keeps the first controller; a failed Worker is replaced on next use", async () => {
  const { api, created, workers, window, reload } = loadBrowserBundle();
  reload();
  assert.equal(window.PRX_SOLVER, api, "loading the bundle twice keeps one controller");
  assert.equal((await api.mipSolve(E1, { tau: 0.25 })).status, "optimal");
  assert.equal(created.length, 1);
  // an uncaught error in the Worker rejects what is pending and terminates it
  const pending = api.mipSolve(E1, { tau: 0.3 });
  workers[0].onerror?.({ message: "simulated crash", preventDefault() {} });
  await assert.rejects(pending, /solver worker (failed: simulated crash|is not running)/);
  assert.equal(workers[0].terminated, true);
  // the next request starts a new Worker, which builds a new model
  const r = await api.mipSolve(E1, { tau: 0.3 });
  assertMatchesExact(r, exact(E1, 0.3), E1, 0.3, undefined, "after a Worker failure");
  assert.equal(r.reused, false);
  assert.equal(created.length, 2);
});
