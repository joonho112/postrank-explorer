import { test } from "node:test";
import assert from "node:assert/strict";
import { errorArray, finiteLawPairwise, type ErrorArray } from "../src/pairwise.ts";
import { type Family } from "../src/report.ts";
import { evaluateReport } from "../src/risk.ts";
import { enumerateReports, exactOptimum, type ExactOptimum } from "../src/optimize.ts";
import { rng } from "../src/random.ts";
import {
  budgetCheck, budgetFamily, commonalityCost, conflictPairs, criterionMixtureRisk, estimandCosts, minimaxChoice, weightCrossing,
  weightedError,
} from "../src/multi.ts";

const close = (got: number | null, want: number, tol: number, what = "") =>
  assert.ok(got !== null && Math.abs(got - want) <= tol, `${what} got ${got}, want ${want} (tol ${tol})`);

// The six sites with scores A and B (pr_tutorial$two: independent normals, SD .20). Score B's means follow from
// the vignette m2 composite scores .950, .675, .575, .375, −.500, −.750 at a = (1/2, 1/2): .7, .4, .9, .6, −.5, −.7.
const SIX_A = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];
const SIX_B = [0.7, 0.4, 0.9, 0.6, -0.5, -0.7];
const E2 = errorArray(SIX_A.map((a, i) => [a, SIX_B[i]]), 0.2, { criteria: ["score_A", "score_B"] });
const E6 = errorArray(SIX_A, 0.2);
const CAP3: Family = { kind: "atMost", G: 3 };

// Theory book ch. 13 two-unit law: criterion 1 certainly favours A, criterion 2 is an even chance.
const TWO: ErrorArray = {
  ids: ["A", "B"],
  criteria: ["c1", "c2"],
  e: [
    [[Number.NaN, 0], [1, Number.NaN]],
    [[Number.NaN, 0.5], [0.5, Number.NaN]],
  ],
};

function randomE(seed: number, n: number, K: number): ErrorArray {
  const u = rng(seed);
  const e = Array.from({ length: K }, () => Array.from({ length: n }, () => new Array<number>(n).fill(Number.NaN)));
  for (let k = 0; k < K; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const x = u();
        e[k][i][j] = x;
        e[k][j][i] = 1 - x;
      }
    }
  }
  return { ids: Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)), criteria: Array.from({ length: K }, (_, k) => `k${k + 1}`), e };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

test("conflictPairs: six sites, scores A and B: A–C, B–C and B–D point opposite ways", () => {
  const c = conflictPairs(E2);
  assert.equal(c.count, 3);
  assert.deepEqual(
    c.pairs.map((p) => [p.i, p.j]),
    [[0, 2], [1, 2], [1, 3]],
  );
  // B–C: e = .0067 on score A (B above C likely), .9615 on score B (C above B likely)
  assert.deepEqual(c.pairs[1], { i: 1, j: 2, iAbove: [0], jAbove: [1] });
  close(E2.e[0][1][2], 0.0067, 5e-5);
  close(E2.e[1][1][2], 0.9615, 5e-5);
  // one criterion never conflicts; an error of exactly 1/2 favours neither direction
  assert.equal(conflictPairs(E6).count, 0);
  assert.equal(conflictPairs(TWO).count, 0);
  const flip: ErrorArray = { ...TWO, e: [TWO.e[0], [[Number.NaN, 1], [0, Number.NaN]]] };
  assert.deepEqual(conflictPairs(flip).pairs, [{ i: 0, j: 1, iAbove: [0], jAbove: [1] }]);
});

test("weightedError: ebar = Σ_k w_k e_k with a NaN diagonal; A–B at equal weights is (.188 + .144)/2 = .166", () => {
  const eb = weightedError(E2, [0.5, 0.5]);
  close(eb[0][1], 0.166, 5e-4, "ebar_AB");
  close(eb[0][3], 0.181, 5e-4, "ebar_AD");
  assert.ok(Number.isNaN(eb[2][2]));
  for (let i = 0; i < 6; i += 1) for (let j = 0; j < 6; j += 1) if (i !== j) close(eb[i][j], (E2.e[0][i][j] + E2.e[1][i][j]) / 2, 1e-16);
  assert.deepEqual(weightedError(E6), E6.e[0]);
  assert.throws(() => weightedError(E2), /weights w are required/);
});

test("commonalityCost: six sites, w = (1/2, 1/2), τ = .20, at most 3 grades: Δ_A ≈ .0490, Δ_B ≈ .0145", (t) => {
  const cc = commonalityCost(E2, { tau: 0.2, w: [0.5, 0.5], family: CAP3 });
  assert.deepEqual(cc.common.grade, [1, 1, 1, 1, 2, 3]);
  assert.equal(cc.family.size, 603);
  assert.equal(cc.label, "exact-within-family");
  const [a, b] = cc.criteria;
  assert.equal(a.criterion, "score_A");
  close(a.commonRk, 0.0906, 5e-5, "R_A(common)");
  close(b.commonRk, 0.096, 5e-5, "R_B(common)");
  assert.deepEqual(a.ownGrades, [[1, 1, 2, 2, 3, 3]]);
  close(a.ownRk, 0.0417, 5e-5, "R_A(own)");
  // score B has two tied own optima; the storyboard's 2/2/1/2/3/3 is one of them
  assert.ok(b.ownGrades.some((g) => g.join() === "2,2,1,2,3,3"));
  close(b.ownRk, 0.0816, 5e-5, "R_B(own)");
  close(a.delta, 0.049, 5e-5, "Δ_A");
  close(b.delta, 0.0145, 5e-5, "Δ_B");
  // definitions: own optima = every report of the family minimizing R_k (brute force), Δ = common − own
  for (const row of cc.criteria) {
    const risks = [...enumerateReports(6, CAP3)].map((g) => ({ g: Array.from(g), r: evaluateReport(g, E2, { tau: 0.2, w: [0.5, 0.5] }).Rk[row.k] }));
    const min = Math.min(...risks.map((x) => x.r));
    assert.deepEqual(row.ownGrades, risks.filter((x) => x.r <= min + 1e-12).map((x) => x.g));
    assert.equal(row.ownRk, evaluateReport(row.ownGrade, E2, { tau: 0.2, w: row.k === 0 ? [1, 0] : [0, 1] }).risk);
    assert.equal(row.delta, row.commonRk - row.ownRk);
    assert.ok(row.relationAgreement > 0 && row.relationAgreement <= 1);
  }
  // one criterion: the common report is its own best, Δ = 0 and full agreement
  const one = commonalityCost(E6, { tau: 0.2, family: CAP3 });
  assert.equal(one.criteria[0].delta, 0);
  assert.equal(one.criteria[0].relationAgreement, 1);
  // too large to enumerate: case pages read archived costs
  assert.throws(() => commonalityCost(randomE(3, 9, 2), { tau: 0.2, w: [0.5, 0.5] }), /exact enumeration covers at most/);
  // an empty family returns { empty: true, family } (E-15)
  const none = commonalityCost(E2, { tau: 0.2, w: [0.5, 0.5], family: { kind: "exactly", G: 7 } });
  assert.equal(none.empty, true);
  assert.equal(none.family.size, 0);
  const ms: number[] = [];
  for (let r = 0; r < 7; r += 1) {
    const t0 = performance.now();
    commonalityCost(E2, { tau: 0.2, w: [0.5, 0.5], family: CAP3 });
    ms.push(performance.now() - t0);
  }
  const all: number[] = [];
  for (let r = 0; r < 7; r += 1) {
    const t0 = performance.now();
    commonalityCost(E2, { tau: 0.2, w: [0.5, 0.5] });
    all.push(performance.now() - t0);
  }
  t.diagnostic(`commonalityCost six sites, K = 2: at most 3 grades (603 reports × 3 solves) ${median(ms).toFixed(2)} ms; all 4,683 reports ${median(all).toFixed(2)} ms (median of 7)`);
});

test("estimandCosts: the m2 known state A = (1, −2), B = (0, 0), w = (3/4, 1/4), a = (1/2, 1/2), τ = .3", () => {
  const r = estimandCosts([[1, -2], [0, 0]], { w: [0.75, 0.25], a: [0.5, 0.5], tau: 0.3 });
  assert.deepEqual(r.criterionLoss, { costs: { iAboveJ: 0.25, jAboveI: 0.75, withhold: 0.3 }, directionalMinimum: 0.25, best: ["iAboveJ"] });
  assert.deepEqual(r.c, [-0.5, 0]);
  assert.deepEqual(r.compositeLoss, { costs: { iAboveJ: 1, jAboveI: 0, withhold: 0.3 }, directionalMinimum: 0, best: ["jAboveI"] });
  // one exact optimum per loss within 𝒜_2 (3 reports)
  const crit = exactOptimum(r.criterionE, { tau: 0.3, w: [0.75, 0.25] }) as ExactOptimum;
  const comp = exactOptimum(r.compositeE, { tau: 0.3 }) as ExactOptimum;
  assert.equal(crit.family.size, 3);
  assert.deepEqual(crit.grades, [[1, 2]]);
  assert.deepEqual(comp.grades, [[2, 1]]);
  // rescaling criterion 2 by 1/4 flips only the composite
  const s = estimandCosts([[1, -2], [0, 0]], { w: [0.75, 0.25], a: [0.5, 0.5], tau: 0.3, multiplier: [1, 0.25] });
  assert.deepEqual(s.c, [0.25, 0]);
  assert.deepEqual(s.criterionLoss, r.criterionLoss);
  assert.deepEqual(s.compositeLoss.best, ["iAboveJ"]);
  // a = (3/4, 1/4): the two agree for this state (a coincidence)
  assert.deepEqual(estimandCosts([[1, -2], [0, 0]], { w: [0.75, 0.25], a: [0.75, 0.25], tau: 0.3 }).compositeLoss.best, ["iAboveJ"]);
  // composite tie: both strict directions are wrong under the weak-error convention
  const tie = estimandCosts([[1, -1], [0, 0]], { w: [0.5, 0.5], a: [0.5, 0.5], tau: 0.3 });
  assert.deepEqual(tie.compositeLoss.costs, { iAboveJ: 1, jAboveI: 1, withhold: 0.3 });
  assert.deepEqual(tie.compositeLoss.best, ["withhold"]);
  // non-simplex coefficients are allowed in the engine; another pair of a three-unit state
  const three = estimandCosts([[-2, 4], [1, 0], [2, -1]], { w: [0.5, 0.5], a: [0.5, 5], tau: 0.2, multiplier: [1, 0.1], pair: [1, 2] });
  assert.deepEqual(three.pair, [1, 2]);
  three.c.forEach((x, i) => close(x, [1, 0.5, 0.5][i], 1e-15, `c${i}`));
  assert.throws(() => estimandCosts([[1, -2], [0, 0]], { w: [0.75, 0.25], a: [0.5], tau: 0.3 }), /a must hold 2/);
  assert.throws(() => estimandCosts([[1, -2], [0, 0]], { w: [0.75, 0.25], a: [0.5, 0.5], tau: 0.3, multiplier: [1, 0] }), /multiplier/);
  // the old name is refused, not ignored (E-16)
  assert.throws(() => estimandCosts([[1, -2], [0, 0]], { w: [0.75, 0.25], a: [0.5, 0.5], tau: 0.3, scale: [1, 0.25] } as never), /unknown option "scale".*multiplier/);
  assert.throws(() => estimandCosts([[1, -2], [0, 0]], { w: [0.75, 0.25], a: [0.5, 0.5], tau: 0.3, pair: [0, 0] }), /pair/);
});

test("budgetFamily: six sites, q_B = .02 leaves all-withheld and {A–D}/{E, F}; exactly 3 grades leave nothing", () => {
  const r = budgetFamily(E2, { tau: 0.2, w: [0.5, 0.5], family: CAP3, q: [null, 0.02] });
  assert.equal(r.empty, false);
  assert.equal(r.size, 2);
  assert.equal(r.baseSize, 603);
  assert.deepEqual(r.members, [[1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 2, 2]]);
  assert.deepEqual(r.optimum?.grade, [1, 1, 1, 1, 2, 2]);
  assert.equal(r.optimum?.N, 8);
  close(r.optimum?.risk ?? null, 0.0939, 5e-5, "risk");
  close(r.optimum?.EoverN[1] ?? null, 0.0001, 5e-5, "E_B/N");
  assert.equal(r.containsAllWithheld, true);
  // q = (1, .03): three reports and the unconstrained optimum survives
  const r3 = budgetFamily(E2, { tau: 0.2, w: [0.5, 0.5], family: CAP3, q: [1, 0.03] });
  assert.equal(r3.size, 3);
  assert.deepEqual(r3.optimum?.grade, [1, 1, 1, 1, 2, 3]);
  // exactly three grades: empty for every q_B up to .0267
  for (const qB of [0.02, 0.0267]) {
    const e = budgetFamily(E2, { tau: 0.2, w: [0.5, 0.5], family: { kind: "exactly", G: 3 }, q: [1, qB] });
    assert.equal(e.empty, true);
    assert.equal(e.size, 0);
    assert.deepEqual(e.members, []);
    assert.equal(e.optimum, null);
  }
  // w = (1, 0), q = (1, .10): the best budget-meeting report is {A–D}/E/F with risk .0906 on score A
  const wa = budgetFamily(E2, { tau: 0.2, w: [1, 0], family: CAP3, q: [1, 0.1] });
  assert.deepEqual(wa.optimum?.grade, [1, 1, 1, 1, 2, 3]);
  close(wa.optimum?.risk ?? null, 0.0906, 5e-5);
  // members = brute force on random cases
  for (let s = 0; s < 6; s += 1) {
    const E = randomE(100 + s, 5, 2);
    const q = [0.2 + 0.05 * s, s % 2 === 0 ? null : 0.3];
    const fam: Family = s < 3 ? { kind: "all" } : { kind: "atMost", G: 3 };
    const b = budgetFamily(E, { tau: 0.25, w: [0.6, 0.4], family: fam, q });
    const want = [...enumerateReports(5, fam)]
      .map((g) => Array.from(g))
      .filter((g) => evaluateReport(g, E, { tau: 0.25, w: [0.6, 0.4] }).E.every((x, k) => q[k] === null || x <= (q[k] as number) * evaluateReport(g, E, { tau: 0.25, w: [0.6, 0.4] }).N));
    assert.deepEqual(b.members, want);
    assert.equal(b.size, want.length);
  }
});

test("budgetCheck: rows E_k ≤ q_k N on a displayed report; N = 0 passes", () => {
  // score A's own best report fails a budget of .10 on score B (E_B/N ≈ .237)
  const c = budgetCheck([1, 1, 2, 2, 3, 3], E2, [1, 0.1]);
  assert.equal(c.rows.length, 2);
  assert.equal(c.rows[0].meets, true);
  assert.equal(c.rows[1].criterion, "score_B");
  assert.equal(c.rows[1].N, 12);
  close(c.rows[1].EoverN, 0.237, 5e-4, "E_B/N");
  close(c.rows[1].qN, 1.2, 1e-15);
  assert.equal(c.rows[1].slack, c.rows[1].qN - c.rows[1].E);
  assert.equal(c.rows[1].meets, false);
  assert.equal(c.meets, false);
  // null = no budget; all-withheld meets q = 0
  const w = budgetCheck([1, 1, 1, 1, 1, 1], E2, [null, 0]);
  assert.deepEqual(w.rows, [{ k: 1, criterion: "score_B", q: 0, E: 0, N: 0, qN: 0, EoverN: null, slack: 0, meets: true }]);
  assert.equal(w.meets, true);
  assert.throws(() => budgetCheck([1, 2, 3, 4, 5, 6], E2, [0.1]), /q must hold 2/);
});

test("criterionMixtureRisk: Σ_k w_k R_k equals the weighted risk (six-site common report .0933)", () => {
  const m = criterionMixtureRisk([1, 1, 1, 1, 2, 3], E2, { tau: 0.2, w: [0.5, 0.5] });
  close(m.risk, 0.0933, 5e-5);
  close(m.weightedRisk, 0.0933, 5e-5);
  assert.ok(Math.abs(m.difference) < 1e-16);
  const u = rng(9);
  for (let s = 0; s < 50; s += 1) {
    const E = randomE(200 + s, 6, 3);
    const g = Array.from({ length: 6 }, () => 1 + Math.floor(u() * 4));
    const a = u();
    const w = [a / 2, a / 2, 1 - a];
    const r = criterionMixtureRisk(g, E, { tau: 0.05 + 0.4 * u(), w });
    assert.ok(Math.abs(r.difference) <= 1e-15, `difference ${r.difference}`);
  }
});

test("minimaxChoice: the ch. 13 two-unit law at τ = 1/4 (minimax withholds at every ω; weights switch at 1/2)", () => {
  for (const omega of [0.3, 0.5, 0.7, 0.9, 1]) {
    const r = minimaxChoice(TWO, { tau: 0.25, w: [omega, 1 - omega] });
    assert.equal(r.family.size, 3);
    assert.deepEqual(r.included, [0, 1]);
    // reports 1/1 (withhold), 1/2 (A above B), 2/1 (B above A): criterion risks and the maxima 1/4, 1/2, 1
    assert.deepEqual(r.reports?.map((x) => [x.grade, x.Rk, x.max]), [
      [[1, 1], [0.25, 0.25], 0.25],
      [[1, 2], [0, 0.5], 0.5],
      [[2, 1], [1, 0.5], 1],
    ]);
    r.reports?.forEach((x, q) => close(x.weighted, [0.25, (1 - omega) / 2, (1 + omega) / 2][q], 1e-15));
    assert.deepEqual(r.minimax.grades, [[1, 1]]);
    assert.equal(r.minimax.value, 0.25);
    const want = omega < 0.5 ? [[1, 1]] : omega === 0.5 ? [[1, 1], [1, 2]] : [[1, 2]];
    assert.deepEqual(r.weighted.grades, want, `ω = ${omega}`);
  }
  // guarding criterion 1 only (by index or id) at ω = 1 discloses A above B
  assert.deepEqual(minimaxChoice(TWO, { tau: 0.25, w: [1, 0], criteria: [0] }).minimax.grade, [1, 2]);
  assert.deepEqual(minimaxChoice(TWO, { tau: 0.25, w: [1, 0], criteria: ["c1"] }).minimax.grade, [1, 2]);
  // exactly two grades: withholding is gone and minimax states A above B with value 1/2
  const ex = minimaxChoice(TWO, { tau: 0.25, w: [0.9, 0.1], family: { kind: "exactly", G: 2 } });
  assert.deepEqual(ex.minimax.grades, [[1, 2]]);
  assert.equal(ex.minimax.value, 0.5);
  assert.throws(() => minimaxChoice(TWO, { tau: 0.25, w: [0.5, 0.5], criteria: ["c3"] }), /unknown criterion/);
  const none = minimaxChoice(TWO, { tau: 0.25, w: [0.5, 0.5], family: { kind: "exactly", G: 3 } });
  assert.equal(none.empty, true);
  assert.equal(none.family.name, "𝒜_=3");
});

test("minimaxChoice = brute force on random cases (K = 3, n = 5; included sets and families)", () => {
  for (let s = 0; s < 8; s += 1) {
    const E = randomE(300 + s, 5, 3);
    const w = [0.5, 0.3, 0.2];
    const fam: Family = s % 2 === 0 ? { kind: "all" } : { kind: "atMost", G: 2 };
    const criteria = s < 4 ? undefined : [0, 2];
    const inc = criteria ?? [0, 1, 2];
    const r = minimaxChoice(E, { tau: 0.3, w, family: fam, criteria });
    const all = [...enumerateReports(5, fam)].map((g) => ({ g: Array.from(g), ev: evaluateReport(g, E, { tau: 0.3, w }) }));
    const mx = all.map((x) => Math.max(...inc.map((k) => x.ev.Rk[k])));
    const min = Math.min(...mx);
    assert.deepEqual(r.minimax.grades, all.filter((_, q) => mx[q] <= min + 1e-12).map((x) => x.g));
    assert.equal(r.reports?.length, all.length);
    const wmin = Math.min(...all.map((x) => x.ev.risk));
    assert.deepEqual(r.weighted.grades, all.filter((x) => x.ev.risk <= wmin + 1e-12).map((x) => x.g));
    // the minimax value is at most the weighted optimum's largest criterion risk
    assert.ok(r.minimax.value <= r.weighted.max + 1e-15);
  }
});

test("weightCrossing (K = 2): the first-criterion weight where a fixed report's risk equals τ", () => {
  // 1/1/2/2/3/3 is good on score A and poor on score B: its risk crosses τ = .20 inside (0, 1)
  const w = weightCrossing([1, 1, 2, 2, 3, 3], E2, { tau: 0.2 });
  assert.ok(w !== null && w > 0 && w < 1);
  close(evaluateReport([1, 1, 2, 2, 3, 3], E2, { tau: 0.2, w: [w, 1 - w] }).risk, 0.2, 1e-15, "risk at the crossing");
  // the common report is below τ for every weight; all-withheld has risk τ for every weight
  assert.equal(weightCrossing([1, 1, 1, 1, 2, 3], E2, { tau: 0.2 }), null);
  assert.equal(weightCrossing([1, 1, 1, 1, 1, 1], E2, { tau: 0.2 }), null);
  // linear in w: random reports, crossing inside (0, 1) whenever R_1 − τ and R_2 − τ have opposite signs
  const u = rng(4);
  for (let s = 0; s < 40; s += 1) {
    const E = randomE(400 + s, 5, 2);
    const g = Array.from({ length: 5 }, () => 1 + Math.floor(u() * 3));
    const ev = evaluateReport(g, E, { tau: 0.3, w: [0.5, 0.5] });
    const x = weightCrossing(g, E, { tau: 0.3 });
    const opposite = (ev.Rk[0] - 0.3) * (ev.Rk[1] - 0.3) < 0;
    assert.equal(x !== null, opposite, `case ${s}`);
    if (x !== null) close(evaluateReport(g, E, { tau: 0.3, w: [x, 1 - x] }).risk, 0.3, 1e-14);
  }
  assert.throws(() => weightCrossing([1, 2, 3, 4, 5, 6], E6, { tau: 0.2 }), /K = 2/);
});

test("multi.ts on a finite law: the ch. 14 four-unit law (weights 3/5, 2/5, τ = 1/4)", () => {
  const LAW4 = finiteLawPairwise(
    [
      [[4, 4], [3, 2], [2, 3], [1, 1]],
      [[3, 1], [4, 2], [2, 3], [1, 4]],
    ],
    [3 / 4, 1 / 4],
  );
  const cc = commonalityCost(LAW4, { tau: 0.25, w: [3 / 5, 2 / 5] });
  for (const row of cc.criteria) assert.ok(row.delta >= 0 && row.delta === Math.max(0, row.commonRk - row.ownRk));
  const m = minimaxChoice(LAW4, { tau: 0.25, w: [3 / 5, 2 / 5] });
  assert.equal(m.reports?.length, 75);
  assert.deepEqual(m.weighted.grade, cc.common.grade);
});
