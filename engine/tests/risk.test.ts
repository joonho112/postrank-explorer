import { test } from "node:test";
import assert from "node:assert/strict";
import { errorArray, finiteLawPairwise, tieLawPairwise } from "../src/pairwise.ts";
import { canonicalGrade } from "../src/report.ts";
import {
  betweenGradeErrors, disclosedErrorEstimands, equalityNeutralRisk, evaluateReport, krwRisk, lambdaToTau, pairDecision,
  realizedWrong, relaxedPairRisk, statedAbove, tauToLambda,
} from "../src/risk.ts";
import { normalCdf } from "../src/special.ts";

const close = (got: number | null, want: number, tol: number, what = "") =>
  assert.ok(got !== null && Math.abs(got - want) <= tol, `${what} got ${got}, want ${want} (tol ${tol})`);

// The six sites, score A: means A–F, SD .20, independent.
const SIX = [1.2, 0.95, 0.25, 0.15, -0.5, -0.8];
const E6 = errorArray(SIX, 0.2);
/** e_ij of the six sites by the closed form, written out in the test. */
const e6 = (i: number, j: number) => normalCdf((SIX[j] - SIX[i]) / Math.sqrt(0.2 * 0.2 + 0.2 * 0.2));

// Theory-book three-unit law (ch. 10): ABC 3/5, ACB 3/20, BAC 3/20, CBA 1/10.
const LAW3 = finiteLawPairwise([[3, 2, 1], [3, 1, 2], [2, 3, 1], [1, 2, 3]], [3 / 5, 3 / 20, 3 / 20, 1 / 10]);

/** Every canonical report on n units (labels 1..G, all used). */
function allReports(n: number): number[][] {
  const out: number[][] = [];
  const g = new Array<number>(n).fill(1);
  for (;;) {
    if (new Set(g).size === Math.max(...g)) out.push([...g]);
    let q = n - 1;
    while (q >= 0 && g[q] === n) g[q--] = 1;
    if (q < 0) return out;
    g[q] += 1;
  }
}

test("six sites: e_AB ≈ .188 and the report 1/1/2/2/3/3 at τ = .20 has N = 12 and risk ≈ .0417", () => {
  close(E6.e[0][0][1], 0.188, 5e-4, "e_AB");
  const ev = evaluateReport([1, 1, 2, 2, 3, 3], E6, { tau: 0.2 });
  assert.equal(ev.M, 15);
  assert.equal(ev.N, 12);
  assert.equal(ev.s, 0.8);
  assert.equal(ev.G, 3);
  // the 12 stated pairs: A, B above C, D, E, F and C, D above E, F
  let E = 0;
  for (const i of [0, 1]) for (const j of [2, 3, 4, 5]) E += e6(i, j);
  for (const i of [2, 3]) for (const j of [4, 5]) E += e6(i, j);
  close(ev.E[0], E, 1e-16, "E");
  close(ev.E[0], 0.02477, 1e-5, "E (hand value)");
  close(ev.risk, 0.0417, 5e-5, "risk (hand value)");
  close(ev.risk, (E + 0.2 * 3) / 15, 1e-16, "risk = (E + τ(M − N))/M");
  close(ev.risk, 0.2 + (E - 0.2 * 12) / 15, 1e-16, "risk = τ + M⁻¹ Σ (e − τ)");
  close(ev.EoverN[0], E / 12, 1e-18, "E/N");
  close(ev.EoverN[0], 0.00206, 5e-6, "E/N (P-11 value .00206)");
  close(ev.EoverM[0], E / 15, 1e-18, "E/M");
  close(ev.errorTerm, E / 15, 1e-18, "errorTerm");
  close(ev.withholdingTerm, 0.04, 1e-16, "withholdingTerm = τ·3/15");
  close(ev.errorTerm + ev.withholdingTerm, ev.risk, 1e-16, "risk split");
  assert.deepEqual(ev.Rk, [ev.risk], "R_1 = R when K = 1");
  assert.equal(ev.Ew, ev.E[0]);
});

test("all-withheld: N = 0, risk = τ, E/N is null (never 0)", () => {
  for (const tau of [0.05, 0.2, 0.25, 1 / 3, 0.5]) {
    const ev = evaluateReport([1, 1, 1, 1, 1, 1], E6, { tau });
    assert.equal(ev.N, 0);
    assert.equal(ev.s, 0);
    assert.equal(ev.G, 1);
    assert.deepEqual(ev.E, [0]);
    assert.deepEqual(ev.EoverN, [null]);
    assert.deepEqual(ev.EoverM, [0]);
    assert.equal(ev.errorTerm, 0);
    close(ev.risk, tau, 1e-16, `risk at τ = ${tau}`);
    close(ev.withholdingTerm, tau, 1e-16, "withholdingTerm");
  }
});

test("strict order 1..6: everything disclosed, risk = E/M", () => {
  const ev = evaluateReport([1, 2, 3, 4, 5, 6], E6, { tau: 0.2 });
  assert.equal(ev.N, 15);
  assert.equal(ev.s, 1);
  assert.equal(ev.G, 6);
  assert.equal(ev.withholdingTerm, 0);
  let E = 0;
  for (let i = 0; i < 6; i += 1) for (let j = i + 1; j < 6; j += 1) E += e6(i, j);
  close(ev.E[0], E, 1e-15, "E");
  close(ev.risk, E / 15, 1e-16, "risk");
  close(ev.EoverN[0], E / 15, 1e-16, "E/N = E/M at N = M");
  // relabelled input gives the same evaluation
  assert.deepEqual(evaluateReport([10, 20, 30, 40, 50, 60], E6, { tau: 0.2 }), ev);
});

test("K = 2: criterion profile, weighted risk, and reduction to K = 1", () => {
  const B = [0.3, 0.9, 0.2, 0.8, -0.6, -0.1];
  const E2 = errorArray(
    SIX.map((m, i) => [m, B[i]]),
    0.2,
    { criteria: ["score_A", "score_B"] },
  );
  const g = [1, 1, 2, 2, 3, 3];
  const ev = evaluateReport(g, E2, { tau: 0.2, w: [0.5, 0.5] });
  const a = evaluateReport(g, E6, { tau: 0.2 });
  const b = evaluateReport(g, errorArray(B, 0.2), { tau: 0.2 });
  close(ev.E[0], a.E[0], 1e-16, "E_A");
  close(ev.E[1], b.E[0], 1e-16, "E_B");
  close(ev.Ew, 0.5 * a.E[0] + 0.5 * b.E[0], 1e-16, "Ew");
  close(ev.Rk[0], a.risk, 1e-16, "R_A");
  close(ev.Rk[1], b.risk, 1e-16, "R_B");
  close(ev.risk, 0.5 * ev.Rk[0] + 0.5 * ev.Rk[1], 1e-16, "R = Σ w_k R_k");
  assert.equal(ev.EoverN.length, 2);
  // weight (1, 0) is the score-A evaluation
  close(evaluateReport(g, E2, { tau: 0.2, w: [1, 0] }).risk, a.risk, 1e-16, "w = (1, 0)");
  assert.throws(() => evaluateReport(g, E2, { tau: 0.2 }), /weights w are required/);
  assert.throws(() => evaluateReport(g, E2, { tau: 0.2, w: [0.6, 0.6] }), /sum to 1/);
  assert.throws(() => evaluateReport(g, E2, { tau: 0.2, w: [1.2, -0.2] }), /≥ 0/);
  assert.throws(() => evaluateReport(g, E2, { tau: 0.2, w: [1] }), /2 weights/);
});

test("τ outside (0, 1/2] and mismatched reports throw", () => {
  for (const tau of [0, -0.1, 0.51, 1, Number.NaN, undefined as unknown as number]) {
    assert.throws(() => evaluateReport([1, 2, 2, 3, 3, 3], E6, { tau }), /tau must lie in \(0, 1\/2\]/);
  }
  assert.doesNotThrow(() => evaluateReport([1, 2, 2, 3, 3, 3], E6, { tau: 0.5 }));
  assert.throws(() => evaluateReport([1, 2, 3], E6, { tau: 0.2 }), /one entry per unit/);
  assert.throws(() => evaluateReport([1, 2, 3, 4, 5, 6], { ids: [], criteria: [], e: [] }, { tau: 0.2 }), /nonempty/);
});

test("finite law (ch. 10): optima 1/1/2 and 1/2/2 at 11/60 against the pairwise 1/6; E/N = 7/40", () => {
  const tau = 1 / 5;
  const risks = allReports(3).map((g) => ({ g, ev: evaluateReport(g, LAW3, { tau }) }));
  assert.equal(risks.length, 13);
  const min = Math.min(...risks.map((r) => r.ev.risk));
  close(min, 11 / 60, 1e-15, "coherent optimum");
  const best = risks.filter((r) => r.ev.risk - min <= 1e-12).map((r) => r.g.join("/"));
  assert.deepEqual(best, ["1/1/2", "1/2/2"]);
  close(relaxedPairRisk(LAW3, { tau }), 1 / 6, 1e-16, "isolated-pair relaxation");
  const ev = evaluateReport([1, 1, 2], LAW3, { tau });
  assert.equal(ev.N, 2);
  close(ev.E[0], 7 / 20, 1e-16, "E");
  close(ev.EoverN[0], 7 / 40, 1e-16, "E/N");
});

test("finite law with ties (package m4): weak-error risks .5, .9, .25 for A above B, B above A, withhold", () => {
  const law = finiteLawPairwise([[0, 1], [1, 1], [2, 1]], [0.1, 0.4, 0.5]);
  close(evaluateReport([1, 2], law, { tau: 0.25 }).risk, 0.5, 1e-16, "A above B");
  close(evaluateReport([2, 1], law, { tau: 0.25 }).risk, 0.9, 1e-16, "B above A");
  close(evaluateReport([1, 1], law, { tau: 0.25 }).risk, 0.25, 1e-16, "withhold");
  // the isolated pair withholds under the weak-error loss
  assert.deepEqual(pairDecision(law.e[0][0][1], law.e[0][1][0], 0.25).best, ["withhold"]);
});

test("pairDecision: costs e_ij, e_ji, τ and every action within 1e-12 of the minimum", () => {
  const d = pairDecision(0.188, 0.812, 0.2);
  assert.deepEqual(d.costs, { iAboveJ: 0.188, jAboveI: 0.812, withhold: 0.2 });
  assert.deepEqual(d.best, ["iAboveJ"]);
  assert.deepEqual(pairDecision(0.3, 0.7, 0.2).best, ["withhold"]);
  assert.deepEqual(pairDecision(0.85, 0.15, 0.2).best, ["jAboveI"]);
  assert.deepEqual(pairDecision(0.2, 0.8, 0.2).best, ["iAboveJ", "withhold"], "co-optimal at e = τ");
  assert.deepEqual(pairDecision(0.5, 0.5, 0.5).best, ["iAboveJ", "jAboveI", "withhold"], "all three at τ = e = 1/2");
  assert.throws(() => pairDecision(0.3, 0.7, 0.6), /tau/);
});

test("lambdaToTau and tauToLambda: λ = .25 ↔ τ = .20, endpoints λ = 1 ↔ τ = 1/2", () => {
  assert.equal(lambdaToTau(0.25), 0.2);
  assert.equal(tauToLambda(0.2), 0.25);
  assert.equal(lambdaToTau(1), 0.5);
  assert.equal(tauToLambda(0.5), 1);
  for (const tau of [0.01, 0.1, 0.2, 0.25, 1 / 3, 0.45]) close(lambdaToTau(tauToLambda(tau)), tau, 1e-16, `round trip ${tau}`);
  for (const bad of [0, -0.5, 1.5, Number.NaN]) assert.throws(() => lambdaToTau(bad), /lambda/);
  for (const bad of [0, 0.6]) assert.throws(() => tauToLambda(bad), /tau/);
});

test("krwRisk: (1 − λ)DR − λτ̄, and R_τ = τ + (1 − τ)R_K,λ for every report of a tie-free law", () => {
  const lambda = 0.25;
  const tau = lambdaToTau(lambda);
  for (const [E, n] of [
    [E6, 6],
    [LAW3, 3],
  ] as const) {
    for (const g of allReports(n)) {
      const ev = evaluateReport(g, E, { tau });
      const kr = krwRisk(g, E, { lambda });
      close(ev.risk, tau + (1 - tau) * kr, 1e-15, `affine identity at ${g.join("/")}`);
      const DR = ev.E[0] / ev.M;
      close(kr, (1 - lambda) * DR - lambda * (ev.N - 2 * ev.E[0]) / ev.M, 1e-15, "definition");
    }
  }
  assert.equal(krwRisk([1, 1, 1, 1, 1, 1], E6, { lambda }), 0, "all-withheld has KRW risk 0");
  // λ = 0 is the discordance rate DR = E/M
  const ev = evaluateReport([1, 1, 2, 2, 3, 3], E6, { tau: 0.2 });
  close(krwRisk([1, 1, 2, 2, 3, 3], E6, { lambda: 0 }), ev.EoverM[0], 1e-18, "λ = 0");
  const E2 = errorArray([[1, 0], [0, 1]], 0.2);
  assert.throws(() => krwRisk([1, 2], E2, { lambda }), /K = 1/);
  assert.throws(() => krwRisk([1, 2, 3, 4, 5, 6], E6, { lambda: 1.5 }), /lambda/);
});

test("betweenGradeErrors: stated pairs between each grade pair, mean and largest error", () => {
  const rows = betweenGradeErrors([1, 1, 2, 2, 3, 3], E6);
  assert.deepEqual(
    rows.map((r) => [r.h, r.hp, r.pairs]),
    [
      [1, 2, 4],
      [1, 3, 4],
      [2, 3, 4],
    ],
  );
  close(rows[0].meanError, (e6(0, 2) + e6(0, 3) + e6(1, 2) + e6(1, 3)) / 4, 1e-17, "mean, grades 1–2");
  close(rows[0].maxError, e6(1, 2), 1e-17, "largest, grades 1–2: B above C");
  close(rows[2].maxError, e6(3, 4), 1e-17, "largest, grades 2–3: D above E");
  // adjacent grades carry the least certain directions here
  assert.ok(rows[1].maxError < rows[0].maxError && rows[1].maxError < rows[2].maxError);
  assert.deepEqual(betweenGradeErrors([1, 1, 1, 1, 1, 1], E6), []);
  const sizes = betweenGradeErrors([3, 1, 2, 2, 1, 3], E6).map((r) => r.pairs);
  assert.deepEqual(sizes, [4, 4, 4]);
});

test("statedAbove: stated pairs whose error exceeds τ, and the largest stated error", () => {
  // ch. 10: 1/1/2 at τ = 1/5 states A above C (1/10) and B above C (1/4)
  const s = statedAbove([1, 1, 2], LAW3, { tau: 1 / 5 });
  assert.equal(s.count, 1);
  assert.equal(s.pairs.length, 1);
  assert.deepEqual([s.pairs[0].i, s.pairs[0].j], [1, 2]);
  close(s.pairs[0].error, 1 / 4, 1e-16, "B above C");
  close(s.max, 1 / 4, 1e-16, "max");
  const none = statedAbove([1, 1, 2, 2, 3, 3], E6, { tau: 0.2 });
  assert.equal(none.count, 0);
  close(none.max, e6(3, 4), 1e-17, "largest stated error, D above E, below τ");
  const silent = statedAbove([1, 1, 1], LAW3, { tau: 0.2 });
  assert.deepEqual(silent, { pairs: [], count: 0, max: null });
});

test("realizedWrong: wrong stated directions at one state; equality counts as wrong", () => {
  const theta = [3, 1, 1];
  assert.deepEqual(realizedWrong([1, 2, 2], theta), { N: 2, D: [0], DoverN: [0], A: 0, AoverN: 0, pairs: [[]] });
  // B above A (1 ≤ 3) and B above C (1 ≤ 1, a latent equality) are both wrong
  const r = realizedWrong([2, 1, 2], theta);
  assert.deepEqual(r.D, [2]);
  assert.deepEqual(r.pairs, [
    [
      { i: 1, j: 0 },
      { i: 1, j: 2 },
    ],
  ]);
  assert.equal(r.AoverN, 1);
  assert.deepEqual(realizedWrong([1, 1, 1], theta).DoverN, [null]);
  // K = 2 with weights: A = Σ w_k D_k
  const two = realizedWrong([1, 2, 3], [[3, 0], [2, 1], [1, 2]], { w: [0.6, 0.4] });
  assert.deepEqual(two.D, [0, 3]);
  close(two.A, 1.2, 1e-15, "A");
  close(two.AoverN, 0.4, 1e-15, "A/N");
  assert.equal(realizedWrong([1, 2, 3], [[3, 0], [2, 1], [1, 2]]).A, null, "no weights, no A");
});

test("realized and expected counts agree: E_k is the law average of D_k", () => {
  const states = [[3, 2, 1], [3, 1, 2], [2, 3, 1], [1, 2, 3]];
  const probs = [3 / 5, 3 / 20, 3 / 20, 1 / 10];
  for (const g of allReports(3)) {
    const avg = states.reduce((s, theta, q) => s + probs[q] * realizedWrong(g, theta).D[0], 0);
    close(evaluateReport(g, LAW3, { tau: 0.2 }).E[0], avg, 1e-15, g.join("/"));
  }
});

test("equalityNeutralRisk (package m4 law): .1 for A above B, .15 = R0 for withholding, .5 for B above A", () => {
  const tie = tieLawPairwise([[0, 1], [1, 1], [2, 1]], [0.1, 0.4, 0.5]);
  const above = equalityNeutralRisk([1, 2], tie, { tau: 0.25 });
  close(above.risk, 0.1, 1e-16, "A above B");
  close(above.R0, 0.15, 1e-16, "R0 = τ(1 − t)");
  close(equalityNeutralRisk([2, 1], tie, { tau: 0.25 }).risk, 0.5, 1e-16, "B above A");
  const hold = equalityNeutralRisk([1, 1], tie, { tau: 0.25 });
  close(hold.risk, 0.15, 1e-16, "withhold");
  close(hold.risk, hold.R0, 1e-16, "all-withheld risk = R0");
  // a structural tie (t = 1): every action has neutral risk 0
  const same = tieLawPairwise([[1, 1], [2, 2]], [0.5, 0.5]);
  for (const g of [[1, 2], [2, 1], [1, 1]]) assert.deepEqual(equalityNeutralRisk(g, same, { tau: 0.25 }), { risk: 0, R0: 0 });
});

test("equalityNeutralRisk equals the weak-error risk when ties have probability zero (R0 = τ)", () => {
  const tie = tieLawPairwise([[3, 2, 1], [3, 1, 2], [2, 3, 1], [1, 2, 3]], [3 / 5, 3 / 20, 3 / 20, 1 / 10]);
  for (const g of allReports(3)) {
    const neutral = equalityNeutralRisk(g, tie, { tau: 0.2 });
    close(neutral.risk, evaluateReport(g, LAW3, { tau: 0.2 }).risk, 1e-16, g.join("/"));
    close(neutral.R0, 0.2, 1e-16, "R0");
  }
});

test("weak minus neutral risk = M⁻¹[Σ_stated t̄_ij + τ Σ_withheld t̄_ij] (ch. 11), K = 2 with ties", () => {
  const states = [
    [[1, 0], [1, 1], [0, 1]],
    [[2, 1], [1, 1], [2, 0]],
    [[0, 0], [0, 1], [1, 1]],
  ];
  const probs = [0.5, 0.3, 0.2];
  const w = [0.6, 0.4];
  const tau = 0.3;
  const weak = finiteLawPairwise(states, probs);
  const tie = tieLawPairwise(states, probs);
  for (const g0 of allReports(3)) {
    const g = canonicalGrade(g0);
    const diff = evaluateReport(g, weak, { tau, w }).risk - equalityNeutralRisk(g, tie, { tau, w }).risk;
    let want = 0;
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        if (i === j) continue;
        const tbar = w[0] * tie.t[0][i][j] + w[1] * tie.t[1][i][j];
        if (g[i] < g[j]) want += tbar;
        if (i < j && g[i] === g[j]) want += tau * tbar;
      }
    }
    close(diff, want / 3, 1e-15, g.join("/"));
    assert.ok(diff >= -1e-15, "the difference is nonnegative");
  }
  assert.throws(() => equalityNeutralRisk([1, 2, 3], tie, { tau: 0.6, w }), /tau/);
  assert.throws(() => equalityNeutralRisk([1, 2, 3], { b: tie.b, d: [tie.d[0]] }, { tau, w }), /same shape/);
});

test("disclosedErrorEstimands: the three-case example (ch. 16): 2/5, 1/2, 1/3, 2/3 and 5/9", () => {
  const cases = [
    { A: 2, N: 2, M: 3 },
    { A: 0, N: 3, M: 3 },
    { A: 0, N: 0, M: 3 },
  ];
  const out = disclosedErrorEstimands(cases);
  assert.equal(out.ERR, 2 / 5);
  assert.equal(out.meanFraction, 1 / 2);
  assert.equal(out.zeroImputed, 1 / 3);
  assert.equal(out.positiveFrequency, 2 / 3);
  assert.equal(out.meanDisclosure, 5 / 9);
  assert.deepEqual(disclosedErrorEstimands(cases.map(({ A, N }) => ({ A, N })), { M: 3 }), out, "common M as an option");
  assert.equal(disclosedErrorEstimands(cases.map(({ A, N }) => ({ A, N }))).meanDisclosure, null, "no M, no disclosure share");
  // the open task: case 2 states 1 direction instead of 3; only the count-weighted summaries move
  const moved = disclosedErrorEstimands([cases[0], { A: 0, N: 1, M: 3 }, cases[2]]);
  assert.equal(moved.ERR, 2 / 3);
  assert.equal(moved.meanFraction, 1 / 2);
  assert.equal(moved.zeroImputed, 1 / 3);
  assert.equal(moved.meanDisclosure, 1 / 3);
  const silent = disclosedErrorEstimands([{ A: 0, N: 0, M: 3 }]);
  assert.deepEqual(silent, { ERR: null, meanFraction: null, zeroImputed: 0, positiveFrequency: 0, meanDisclosure: 0 });
  assert.throws(() => disclosedErrorEstimands([{ A: 1, N: 0 }]), /discloses nothing/);
  assert.throws(() => disclosedErrorEstimands([]), /nonempty/);
});
