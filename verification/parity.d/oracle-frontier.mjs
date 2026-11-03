// Parity for engine/src/frontier.ts and tauPath (engine/src/optimize.ts) against base R (r-export/05_frontier.R,
// group oracle-frontier): report clouds per disclosure N, the lower hull H(m) of the theory book ch. 16, supporting
// vertices, matched disclosure, tau paths, order hulls and the half-slope eligibility rule, on the six tutorial
// sites, the ch. 16 four-unit law and the twelve CDE schools with at most three grades.
// Calls follow engine/API.md: cloud = reportCloud(E, { w, family }); hull = lowerHull(cloud);
// supportingVertex(hull, tau); matchedDisclosure(cloud, hull, N); tauPath(E, { w, family });
// orderHull(E, { order, w, G }); halfSlopeEligible({ family, tieFree, positiveWeights }).
// Shapes the API leaves open are normalized here, never the values:
//   - a cloud, hull, path or vertex set may be an array or an object holding one (rows / vertices / segments / path);
//     cloud rows with count 0 (unattained N) are dropped, the rest sorted by N;
//   - supportingVertex may return one vertex or an array of tied vertices: compared as the set of their N (sorted);
//   - tauPath returns { intervals, endpointOptima, ... }: the golden EoverN is the weighted Ew/N of the interval's
//     report (null at N = 0); the engine names it EwOverN (its EoverN holds one ratio per criterion), so EwOverN is read;
//   - matchedDisclosure: H, best ({ grade, Ew } or null), and the mixture. Between vertices psi (the weight on the
//     upper vertex) and both adjacent vertices are compared; at a vertex only the mixture's mean point
//     ((1 - psi) lower + psi upper, which must equal (N, H)) is compared, since lower/upper/psi are then a convention.
// Grades at hull vertices are compared exactly; every vertex has a unique report (checked in R).
// Rows whose array comes from a package dataset (args.arraySource = "package") are wrapped as { pkg: ... }.
const toNaN = (x) => (x === null ? NaN : Array.isArray(x) ? x.map(toNaN) : x);
const errIn = (E) => ({ ...E, e: toNaN(E.e) });
const arr = (g) => Array.from(g);
const nn = (x) => (x === undefined || (typeof x === "number" && Number.isNaN(x)) ? null : x);
const wrap = (a, out) => (a.arraySource === "package" ? { pkg: out } : out);
const listOf = (r, keys) => {
  if (Array.isArray(r)) return r;
  for (const k of keys) if (r && Array.isArray(r[k])) return r[k];
  return r;
};
const opts = (a) => ({ w: a.w, family: a.family });
const cloudOf = (a, pc) => pc.reportCloud(errIn(a.E), opts(a));
const vertices = (h) => listOf(h, ["vertices", "hull", "points"]);
const hullOut = (h) => {
  const v = vertices(h);
  return { N: v.map((x) => x.N), Ew: v.map((x) => x.Ew), grade: v.map((x) => arr(x.grade)) };
};
const mix = (lo, up, psi) => {
  if (lo && up && typeof psi === "number") return { N: (1 - psi) * lo.N + psi * up.N, Ew: (1 - psi) * lo.Ew + psi * up.Ew };
  const v = lo ?? up;
  return v ? { N: v.N, Ew: v.Ew } : { N: null, Ew: null };
};

const RUN = {
  reportCloud: (a, pc) => {
    const rows = listOf(cloudOf(a, pc), ["rows", "perN", "byN", "cloud"]);
    const cloud = rows.filter((p) => p.count > 0).sort((p, q) => p.N - q.N)
      .map((p) => ({ N: p.N, minEw: p.minEw, maxEw: p.maxEw, count: p.count }));
    return wrap(a, { cloud });
  },
  lowerHull: (a, pc) => wrap(a, hullOut(pc.lowerHull(cloudOf(a, pc)))),
  supportingVertex: (a, pc) => {
    const r = pc.supportingVertex(pc.lowerHull(cloudOf(a, pc)), a.tau);
    const v = (Array.isArray(r) ? r : Array.isArray(r?.vertices) ? r.vertices : [r]).slice().sort((p, q) => p.N - q.N);
    return wrap(a, { N: v.map((x) => x.N), Ew: v.map((x) => x.Ew) });
  },
  matchedDisclosure: (a, pc) => {
    const cloud = cloudOf(a, pc);
    const r = pc.matchedDisclosure(cloud, pc.lowerHull(cloud), a.N);
    const m = mix(r.lower, r.upper, r.psi);
    return wrap(a, {
      H: r.H,
      best: r.best == null ? null : { grade: arr(r.best.grade), Ew: r.best.Ew },
      psi: nn(r.psi), lowerN: r.lower?.N ?? null, lowerEw: r.lower?.Ew ?? null, upperN: r.upper?.N ?? null, upperEw: r.upper?.Ew ?? null,
      mixN: m.N, mixEw: m.Ew,
    });
  },
  tauPath: (a, pc) => {
    const seg = pc.tauPath(errIn(a.E), opts(a)).intervals;
    return wrap(a, {
      tauFrom: seg.map((s) => s.tauFrom), tauTo: seg.map((s) => s.tauTo), N: seg.map((s) => s.N), Ew: seg.map((s) => s.Ew),
      EoverN: seg.map((s) => nn(s.EwOverN !== undefined ? s.EwOverN : s.EoverN)), grade: seg.map((s) => arr(s.grade)),
    });
  },
  orderHull: (a, pc) => {
    const o = { order: a.order, w: a.w }; if (a.G !== undefined) o.G = a.G;
    return hullOut(pc.orderHull(errIn(a.E), o));
  },
  halfSlopeEligible: (a, pc) => ({ eligible: pc.halfSlopeEligible(a.input) }),
};

export default {
  group: "oracle-frontier",
  run(args, pc) {
    const f = RUN[args.fn];
    if (!f) throw new Error(`no adapter for fn ${args.fn}`);
    return f(args, pc);
  },
  // Closed-form inputs (pnorm coefficients, exact rationals) and exact counts: 1e-12 absolute (Ew sums of at most 15
  // terms; slopes are differences of such sums over integer steps).
  default: { abs: 1e-12, rel: 0 },
  tolerance: {
    // CDE (pr_case_cde$input$e, package quadrature probabilities): 1e-10 absolute.
    pkg: { abs: 1e-10, rel: 0 },
  },
};
