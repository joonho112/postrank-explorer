// Parity for the tie rules of engine/src/optimize.ts and frontier.ts against base R (r-export/13_dp_ties.R, group
// oracle-ties): every tied optimum of an order family and the package tie rule (fewer grades, then the earlier cut)
// for fixedOrderDP and exactOptimum; the fixedOrderDP trace of the theory book ch. 14 example (W, V, riskByG);
// orderHull with exact counts, blocks, the family form and scores; fixedOrderDP given scores or a family; the maxTies
// cap and tieCount of exactOptimum and minimaxChoice; empty families ({ empty: true }); family.size as a number up
// to 2^53 and a decimal string above, with sizeExact a BigInt; weightBreakpoints (K = 2).
// Inputs: matrices store the NaN diagonal as null; {"$sum": [a, b]} is a + b in double precision (an input one ulp off
// a decimal). Each function gets only the option keys it documents (unknown keys throw, decision E-2).
// Shapes compared:
//   fixedOrderDP   { grade, risk, grades, gradesOrder, tieCount, label, family: { size, sizeExact } }; `grades` (every
//                  tied optimum) is compared as returned, with gradesOrder "lexicographic" (engine/README.md: all tied
//                  cut sets are visited and listed lexicographically when tieCount n <= 2e7)
//   exactOptimum   { grade, grades (lexicographic, as returned), tieCount, risk, label, family }
//   trace          fixedOrderDP(..., { trace: true }).trace: { M, T, W, V, riskByG, chosenG }; W(a, b) is read for
//                  boundaries a < b (row-major, `Wupper`); V[h][c] for h = 0..H with -Infinity as null; riskByG is
//                  indexed by the grade count h (entry 0 must be null) and compared for h = 1..H
//   orderHull      vertices [{ N, Ew, grade }]
//   minimaxChoice  weighted / minimax { grades, tieCount }
//   tauPath        { intervals: [{ tauFrom, tauTo, N, grade }], endpointOptima, endpointTieCount }
//   weightBreakpoints { intervals: [{ wFrom, wTo, grade, N, riskFrom, riskTo }] }; a report optimal only at an end
//                  has a zero-length interval there (the engine's float breakpoint may sit within 1e-14 of the end)
const decode = (x) => {
  if (x === null) return NaN;
  if (Array.isArray(x)) return x.map(decode);
  if (x && typeof x === "object" && "$sum" in x) return x.$sum.reduce((s, v) => s + v);
  return x;
};
const errIn = (E) => ({ ...E, e: decode(E.e) });
const arr = (g) => Array.from(g, Number);
const pick = (a, keys) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));
const nn = (x) => (x === undefined || x === -Infinity || (typeof x === "number" && Number.isNaN(x)) ? null : x);
const DP_KEYS = ["order", "tau", "w", "G", "exact", "blocks", "family", "scores", "direction", "ids", "tieTol"];
const HULL_KEYS = ["order", "w", "G", "exact", "blocks", "family", "scores", "direction", "ids"];
const sizeOut = (f) => ({ familySize: f.size, familySizeExact: f.sizeExact === undefined ? undefined : String(f.sizeExact) });

export const RUN = {
  fixedOrderDP: (a, pc) => {
    const r = pc.fixedOrderDP(errIn(a.E), pick(a, DP_KEYS));
    if (r.empty) return { empty: true };
    return {
      grade: arr(r.grade), risk: r.risk, label: r.label, tieCount: r.tieCount, gradesOrder: r.gradesOrder,
      grades: r.grades === undefined ? undefined : Array.from(r.grades, arr), ...sizeOut(r.family),
    };
  },
  fixedOrderDPTrace: (a, pc) => {
    const r = pc.fixedOrderDP(errIn(a.E), { ...pick(a, DP_KEYS), trace: true });
    const t = r.trace; const m = t.W.length - 1;
    const Wupper = []; for (let i = 0; i < m; i++) for (let j = i + 1; j <= m; j++) Wupper.push(t.W[i][j]);
    if (t.riskByG.length !== t.V.length || nn(t.riskByG[0]) !== null) throw new Error("riskByG must be indexed by h = 0..H with entry 0 null");
    return { M: t.M, T: t.T, Wupper, V: t.V.map((row) => Array.from(row, nn)), riskByG: Array.from(t.riskByG, nn).slice(1), chosenG: t.chosenG,
             grade: arr(r.grade), risk: r.risk };
  },
  exactOptimum: (a, pc) => {
    const r = pc.exactOptimum(errIn(a.E), pick(a, ["tau", "w", "family", "q", "tieTol", "maxTies"]));
    if (r.empty) return { empty: true };
    return { grade: arr(r.grade), grades: Array.from(r.grades, arr), tieCount: r.tieCount, risk: r.risk, label: r.label, ...sizeOut(r.family) };
  },
  orderHull: (a, pc) => {
    const r = pc.orderHull(errIn(a.E), pick(a, HULL_KEYS));
    if (r.empty) return { empty: true };
    return { N: r.map((v) => v.N), Ew: r.map((v) => v.Ew), grade: r.map((v) => arr(v.grade)) };
  },
  minimaxChoice: (a, pc) => {
    const r = pc.minimaxChoice(errIn(a.E), pick(a, ["w", "tau", "family", "criteria", "tieTol", "maxTies"]));
    if (r.empty) return { empty: true };
    return { weightedGrades: Array.from(r.weighted.grades, arr), weightedTieCount: r.weighted.tieCount,
             minimaxGrades: Array.from(r.minimax.grades, arr), minimaxTieCount: r.minimax.tieCount };
  },
  tauPath: (a, pc) => {
    const r = pc.tauPath(errIn(a.E), pick(a, ["w", "family", "tieTol", "maxTies"]));
    if (r.empty) return { empty: true };
    return { tauFrom: r.intervals.map((s) => s.tauFrom), tauTo: r.intervals.map((s) => s.tauTo), N: r.intervals.map((s) => s.N),
             grade: r.intervals.map((s) => arr(s.grade)), endpointOptima: Array.from(r.endpointOptima, arr), endpointTieCount: r.endpointTieCount };
  },
  reportCloud: (a, pc) => { const r = pc.reportCloud(errIn(a.E), pick(a, ["w", "family", "tieTol"])); return { empty: r.empty === true }; },
  commonalityCost: (a, pc) => { const r = pc.commonalityCost(errIn(a.E), pick(a, ["w", "tau", "family", "tieTol"])); return { empty: r.empty === true }; },
  budgetFamily: (a, pc) => { const r = pc.budgetFamily(errIn(a.E), pick(a, ["w", "tau", "family", "q", "tieTol"])); return { empty: r.empty === true }; },
  weightBreakpoints: (a, pc) => {
    const r = pc.weightBreakpoints(errIn(a.E), pick(a, ["tau", "family", "tieTol"]));
    if (r.empty) return { empty: true };
    const rows = r.intervals;
    return { wFrom: rows.map((s) => s.wFrom), wTo: rows.map((s) => s.wTo), grade: rows.map((s) => arr(s.grade)), N: rows.map((s) => s.N),
             riskFrom: rows.map((s) => s.riskFrom), riskTo: rows.map((s) => s.riskTo) };
  },
};

export default {
  group: "oracle-ties",
  functions: ["fixedOrderDP", "exactOptimum", "orderHull", "minimaxChoice", "weightBreakpoints", "tauPath"],
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Exact rationals, dyadic inputs and closed forms (sums of at most 15 terms): 1e-12 absolute; grades, tie counts and
  // sizes exactly (strings and integers).
  default: { abs: 1e-12, rel: 0 },
};
