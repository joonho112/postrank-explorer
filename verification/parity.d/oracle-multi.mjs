// Parity for engine/src/multi.ts against base R (r-export/06_multi.R, group oracle-multi): exact enumeration of
// small families and the theory book's worked examples (ch. 11 criterion mixture, ch. 12 two estimands, ch. 13
// protections and minimax, vignette m2). Each golden row names the engine function in args.fn; calls follow
// engine/API.md (options objects; E = { ids, criteria, e } with e[k][i][j], null diagonal -> NaN on input).
// Results are read in the shapes engine/README.md documents (no alternative shapes are accepted):
//   conflictPairs   { count, pairs: [{ i, j, iAbove, jAbove }] } -> { pairs: [[i, j]], count, iAbove, jAbove } with
//                   pairs sorted by (i, j) and each pair's criterion lists (0-based indices; criterion k favours i when
//                   e_ij,k < e_ji,k) kept beside it
//   weightedError   Matrix -> { ebar } (null diagonal)
//   commonalityCost { common: exactOptimum result, criteria: [{ commonRk, ownGrade, ownGrades, ownRk, delta,
//                   relationAgreement }] } -> { common (grade), perCriterion }; ownGrades in the engine's
//                   (lexicographic) order, never re-sorted
//   estimandCosts   { c, criterionLoss: { costs, best }, compositeLoss: { costs, best } } -> { composite,
//                   criterionCosts, compositeCosts, criterionBest, compositeBest }; best as a set (action order fixed);
//                   option multiplier[k] multiplies criterion k before c_i = sum_k a_k multiplier_k theta_ik
//   budgetFamily    { empty, size, optimum: { grades, risk } } -> { size, empty, grades, risk } (grades as returned)
//   budgetCheck     { rows: [{ E, N, meets }], meets } -> { E (per criterion), N, meets (per criterion), all }
//   criterionMixtureRisk { risk } -> { risk }
//   minimaxChoice   { weighted: { grades, risk }, minimax: { grades, value } } (grades as returned)
//   weightCrossing  number | null -> { omega }
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const nn = (x) => {
  if (x === undefined) return null;
  if (typeof x === "number") return Number.isNaN(x) ? null : x;
  if (ArrayBuffer.isView(x)) return Array.from(x, nn);
  if (Array.isArray(x)) return x.map(nn);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, nn(v)]));
  return x;
};
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const lex = (p, q) => { for (let t = 0; t < Math.min(p.length, q.length); t++) if (p[t] !== q[t]) return p[t] - q[t]; return p.length - q.length; };
const grades = (gs) => Array.from(gs, (g) => Array.from(g, Number));
const ACTIONS = ["iAboveJ", "jAboveI", "withhold"];
const bestSet = (b) => [...b].sort((x, y) => ACTIONS.indexOf(x) - ACTIONS.indexOf(y));
const pick = (a, keys) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));

export const RUN = {
  conflictPairs: (a, pc) => {
    const r = pc.conflictPairs(errIn(a.E));
    const list = r.pairs.map((p) => ({ ij: [p.i, p.j], iAbove: Array.from(p.iAbove), jAbove: Array.from(p.jAbove) }))
      .sort((p, q) => lex(p.ij, q.ij));
    return { pairs: list.map((p) => p.ij), count: r.count, iAbove: list.map((p) => p.iAbove), jAbove: list.map((p) => p.jAbove) };
  },
  weightedError: (a, pc) => ({ ebar: nn(pc.weightedError(errIn(a.E), a.w)) }),
  commonalityCost: (a, pc) => {
    const r = pc.commonalityCost(errIn(a.E), pick(a, ["w", "tau", "family"]));
    if (r.empty) return { empty: true };
    return {
      common: Array.from(r.common.grade, Number),
      perCriterion: r.criteria.map((c) => ({
        commonRk: c.commonRk, ownRk: c.ownRk, delta: c.delta, ownGrade: Array.from(c.ownGrade, Number),
        ownGrades: grades(c.ownGrades), relationAgreement: c.relationAgreement,
      })),
    };
  },
  estimandCosts: (a, pc) => {
    const r = pc.estimandCosts(a.state, pick(a, ["w", "a", "tau", "multiplier"]));
    return {
      composite: nn(r.c),
      criterionCosts: nn(r.criterionLoss.costs), compositeCosts: nn(r.compositeLoss.costs),
      criterionBest: bestSet(r.criterionLoss.best), compositeBest: bestSet(r.compositeLoss.best),
    };
  },
  budgetFamily: (a, pc) => {
    const r = pc.budgetFamily(errIn(a.E), pick(a, ["w", "tau", "family", "q"]));
    if (r.empty) return { size: r.size, empty: true };
    return { size: r.size, empty: false, grades: grades(r.optimum.grades), risk: r.optimum.risk };
  },
  budgetCheck: (a, pc) => {
    const r = pc.budgetCheck(a.g, errIn(a.E), a.q);
    return { E: r.rows.map((x) => x.E), N: r.rows[0].N, meets: r.rows.map((x) => x.meets), all: r.meets };
  },
  criterionMixtureRisk: (a, pc) => ({ risk: pc.criterionMixtureRisk(a.g, errIn(a.E), { w: a.w, tau: a.tau }).risk }),
  minimaxChoice: (a, pc) => {
    const r = pc.minimaxChoice(errIn(a.E), pick(a, ["w", "tau", "family"]));
    return {
      weighted: { grades: grades(r.weighted.grades), risk: r.weighted.risk },
      minimax: { grades: grades(r.minimax.grades), value: r.minimax.value },
    };
  },
  weightCrossing: (a, pc) => ({ omega: nn(pc.weightCrossing(a.g, errIn(a.E), { tau: a.tau })) }),
};

export default {
  group: "oracle-multi",
  functions: ["conflictPairs", "weightedError", "commonalityCost", "estimandCosts", "budgetFamily", "budgetCheck",
    "criterionMixtureRisk", "minimaxChoice", "weightCrossing"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Exact counts, closed forms and enumeration minima (sums of at most 15 pnorm values or exact rationals; inputs
  // carry 15 significant digits, which moves results by ~1e-15): 1e-12 absolute. Every optimal set in the golden
  // file is separated from the next report by more than 1e-9, so tie sets are stable under these input changes.
  default: { abs: 1e-12, rel: 0 },
};
