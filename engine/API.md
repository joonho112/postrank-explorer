# pr-core API (Phase 2 specification)

This is the contract between the TypeScript implementers (`engine/src/*.ts`) and the independent oracle writers
(`r-export/*.R` + `verification/parity.d/*.mjs`). It turns the function tables of the numerical specification §C and
`part3-5.md` §A into exact signatures, following CONTRACT 7.3–7.5 (options objects; criterion-major arrays e[k][i][j], K × n × n; grade 1 highest;
one seeded stream). Definitions follow the public theory book (`appendices/B-notation.qmd`, ch. 9–17) and postrank 1.1.0.
A change here is recorded in the Phase 2 log (old → new).

## Shared types

```ts
type Grade = number[];                 // canonical labels 1..G, grade 1 = highest priority, length n
type Matrix = number[][];              // n × n, diagonal NaN (JSON null in golden files)
interface ErrorArray {                 // directional error probabilities, criterion-major
  ids: string[];                       // n unit ids
  criteria: string[];                  // K criterion ids
  e: Matrix[];                         // e[k][i][j] = Pr(theta_ik <= theta_jk | Y); e[k][i][i] = NaN
}
type Family =
  | { kind: "all" }                    // 𝒜_n, every ordered partition
  | { kind: "atMost"; G: number }      // 𝒜_≤G
  | { kind: "exactly"; G: number }     // 𝒜_=G
  | { kind: "order"; order: number[]; G?: number; exact?: number; blocks?: number[] }; // contiguous cuts of a declared order (unit indices, top first; blocks = sizes of indivisible runs of equal scores)
interface RiskOptions { tau: number; w?: number[] }   // w length K, nonnegative, sums to 1 (default [1] when K = 1)
```

- Unit indices are 0-based in code. "i above j is stated" when `g[i] < g[j]`; its error on criterion k is `e[k][i][j]`.
- `M = n(n − 1)/2`; `N(g)` = number of unordered pairs in different grades; `s = N/M`; `G(g)` = number of grades.
- Weighted pair error `ebar[i][j] = Σ_k w_k e[k][i][j]`.
- `E_k(g) = Σ_{g_i < g_j} e[k][i][j]`; `Ew = Σ_k w_k E_k`; risk `R = (Ew + τ(M − N))/M = τ + M⁻¹ Σ_{g_i<g_j}(ebar_ij − τ)`.
- `E_k/N` is `null` when N = 0 (displayed "NA: no disclosure"; never 0).
- τ must lie in (0, 1/2]; out-of-range input throws (widgets clamp before calling).
- Optima within a family: every report whose risk is within `tieTol` (absolute, default 1e-12) of the minimum is an
  optimum; `grades` lists all of them in lexicographic order of the grade vector, `grade` is the first.

## special.ts (Step 2.1)
`normalCdf(z)`, `normalSf(z)` (upper tail, accurate in the far tail), `normalPdf(z)`, `normalQuantile(p, { lowerTail = true })`, `erfc(x)`. Same algorithms as R (Cody; AS 241), max relative error about 7e-16 against R 4.6.0.

## random.ts (Step 2.1)
`rng(seed): () => number` (mulberry32, uniforms (x + 0.5)/2³² in (0, 1)), `rngUint32(seed)`, `uniforms(seed, n)`, `normals(seed, n)`,
`normalStream(seed): () => number` (Box–Muller, cos first, sin cached; the exact convention is in `engine/README.md`,
reimplemented in R by `r-export/_rng.R`). Integers and uniforms match R bit for bit; normals agree to about 2 ulp
(different libm), so parity compares normals with relative tolerance 1e-15.

## format.ts (Step 2.1)
Display strings for the registry and widgets: ties-to-even rounding on the exact binary value (as R `sprintf`), no leading
zero below 1, U+2212 minus, BigInt-safe thousands separators, "NA" and "NA: no disclosure", and "below .001" /
"above .999" for probabilities that are not exactly 0 or 1 (see `engine/README.md` for the full list).

## pairwise.ts (Step 2.4)
| Function | Returns |
|---|---|
| `pairDirection(meanA, sdA, meanB, sdB, { corr = 0 })` | π = Pr(θ_A > θ_B) for a bivariate normal; throws if the difference has SD 0 |
| `directionMatrix(means, sds)` | Matrix of π for independent normals (Part 1) |
| `errorArray(means, sds, { ids, criteria, orient })` | ErrorArray for independent normals; `means`, `sds` are n × K; `orient[k]` = +1 (larger is higher priority) or −1 (target sign flipped) |
| `finiteLawPairwise(states, probs, { ids, criteria })` | `{ pi, e, t }` (ErrorArray-shaped: π, weak error, equality probability) for a finite law; `states[s][i][k]` |
| `mixturePairDirection(components)` | π under a mixture of bivariate normals `[{ w, meanA, sdA, meanB, sdB, corr }]` |
| `drawErrors(draws, { ids, criteria })` | ErrorArray from equal-weight draws `draws[s][i][k]` (share of draws with θ_i ≤ θ_j) |
| `tieLawPairwise(states, probs, { ids, criteria })` | `{ b, t, d }`: strict error Pr(θ_i < θ_j), equality Pr(θ_i = θ_j), distinctness 1 − t |

## report.ts (Step 2.5)
| Function | Returns |
|---|---|
| `canonicalGrade(g)` | labels renumbered 1..G in order of first priority (grade 1 = smallest label of the input) |
| `pairCount(n)` | M |
| `disclosure(g)` | `{ M, N, s, G, sizes }` (sizes per grade, grade 1 first) |
| `relations(g)` | Matrix of +1 (row above), 0 (withheld or diagonal), −1 (row below) |
| `weakRelation(g)` | Matrix z with z[i][j] = 1 if g_i ≤ g_j (i ≠ j), plus `{ complete, transitive }` checks |
| `familySize(n, family)` | number (BigInt above 2^53) of reports in the family; the order family respects `blocks` |
| `reportCardRows(g, summaries, sort)` | unit order for `sort` ∈ grade, expected_rank, mean, label (package order rules) |
| `statedAgainst(g, scores, { direction })` | `{ count, pairs: [{ above, below }], units }`: stated pairs whose scores run strictly the other way (Step 7.1) |
| `relationChange(g0, g1, E, { w })` | `{ M, nSame, nNewDisclosed, nNewWithheld, nReversed, agreement, pairs: [{ i, j, from, to, error }] }` (Step 7.1) |
| `cutGrade(n, cuts, { order, blocks })` | Int8Array grade vector from cut positions along an order; a cut inside a block throws (Step 7.1) |

## risk.ts (Step 2.5)
| Function | Returns |
|---|---|
| `pairDecision(eIJ, eJI, tau)` | `{ costs: { iAboveJ, jAboveI, withhold }, best: string[] }` (all actions within 1e-12 of the minimum; names `iAboveJ`, `jAboveI`, `withhold`) |
| `evaluateReport(g, E, { tau, w })` | `{ M, N, s, G, E: number[], EoverN: (number|null)[], EoverM: number[], Rk: number[], Ew, risk, errorTerm, withholdingTerm }`; `Rk[k] = (E_k + τ(M − N))/M` |
| `relaxedPairRisk(E, { tau, w })` | M⁻¹ Σ_{i<j} min(ebar_ij, ebar_ji, τ) (not a report) |
| `betweenGradeErrors(g, E, { w })` | for each grade pair (h < h′): `{ h, hp, pairs, meanError, maxError }` |
| `statedAbove(g, E, { tau, w })` | `{ pairs: [{ i, j, error }] (stated pairs with ebar > τ), count, max }`; `max` = largest stated ebar over all stated pairs, null when N = 0 |
| `realizedWrong(g, theta, { w })` | `{ N, D (per criterion), DoverN, A = Σ w_k D_k, AoverN, pairs }` for one state `theta[i][k]` |
| `lambdaToTau(lambda)`, `tauToLambda(tau)` | τ = λ/(1 + λ) and back (λ in (0, 1]) |
| `krwRisk(g, E, { lambda })` | KRW scalar risk (1 − λ)·DR − λ·τ̄ with DR = E/M and τ̄ = (N − 2E)/M (K = 1) |
| `equalityNeutralRisk(g, tie, { tau, w })` | `{ risk, R0 }` for `tie = { b, d }` (theory book ch. 11; package `postrank_tie_evaluate`) |
| `disclosedErrorEstimands(cases, { M })` | `{ ERR, meanFraction, zeroImputed, positiveFrequency, meanDisclosure }` for equally likely cases `[{ A, N, M? }]` (meanDisclosure null without M) |
| `confidentPairs(g, E, { tau, w })` | `{ count, withheld, stated, pairs: [{ i, j, withheld }] }`: pairs i < j with min(ebar_ij, ebar_ji) < τ (strict), those inside a grade, row-major order (Step 6.14) |

## optimize.ts (Step 2.6)
| Function | Returns |
|---|---|
| `enumerateReports(n, family)` | generator of grade vectors (Int8Array), canonical, lexicographic |
| `exactOptimum(E, { tau, w, family, q, tieTol })` | `{ grade, grades, risk, family: { name, size }, containsAllWithheld, label: "exact-within-family" }`; with `q` (budgets) the family is restricted to E_k ≤ q_k N (N = 0 passes); an empty family returns `{ empty: true, family }` |
| `fixedOrderDP(E, { order, tau, w, G, exact, trace })` | `{ grade, risk, label: "optimal-within-order", trace? }`; package tie rules: units with equal order scores are never split (pass `blocks`), equal objective → fewer grades, then the earlier cut |
| `tauPath(E, { w, family })` | `[{ tauFrom, tauTo, grade, N, Ew, EoverN }]` over (0, 1/2] with exact breakpoints |
| `weightPath(E, { tau, family, grid })` | optimum at each first-criterion weight of the grid (K = 2) |
| `bestReports(E, { tau, w, family, k, stating, tieTol })` | `{ family, matched, reports: [{ grade, risk, N, Ew }] }`: the k smallest risks, optionally among reports stating listed pairs (Step 7.1) |

Enumeration budget: n ≤ 20 and family size ≤ 600,000 (all reports fit through n=8; n=12 with at most3 grades has523,251).

## frontier.ts (Step 2.7)
| Function | Returns |
|---|---|
| `reportCloud(E, { w, family })` | per N: `{ N, minEw, maxEw, count }` (full points only when family size ≤5,000) |
| `lowerHull(cloud)` | vertices `[{ N, Ew, grade }]` of the lower convex hull H(m) |
| `supportingVertex(hull, tau)` | the vertex (or tied vertices) touched by slope τ |
| `matchedDisclosure(cloud, hull, N)` | `{ H, best: { grade, Ew } \| null, psi, lower, upper }` (ψ mixes the adjacent vertices) |
| `orderHull(E, { order, w, G })` | the same hull restricted to contiguous cuts of one order |
| `reportsAtN(E, { w, family, N, k, tieTol })` | `{ family, N, count, reports: [{ grade, Ew }] }`: the k smallest Ew among reports with exactly N stated pairs (Step 7.1) |
| `ruleGap(g, E, { w, hull, tieTol })` | `{ N, Ew, H, gap, psi, lower, upper, onFrontier }`: a report's height above H at its own N (Step 7.1) |
| `halfSlopeEligible({ family, tieFree, positiveWeights })` | true only for the full family 𝒜_n with no latent ties on positive-weight criteria |

## multi.ts (Step 2.8)
`conflictPairs(E)`, `weightedError(E, w)`, `commonalityCost(E, { w, tau, family })` (per criterion `{ commonRk, ownGrades, ownRk, delta }`),
`estimandCosts(state, { w, a, tau, multiplier })`, `budgetFamily(E, { w, tau, family, q })` (size, members' optimum or empty),
`budgetCheck(g, E, q)`, `criterionMixtureRisk(g, E, { w, tau })`, `minimaxChoice(E, { w, tau, family })`,
`weightCrossing(g, E, { tau })` (K = 2: first-criterion weight where the report's risk equals τ).

## rules.ts (Step 2.9)
`strictOrder(scores)` (grade vector 1..n by descending score; ties broken by index),
`tierGrades(scores, G)` (quantile positions t = 1 + ⌊(p − 1)G/n⌋ on descending scores; equal scores share a tier,
as `postrank_cuts(rule = "quantile")`), `evidenceFlags(est, se, { ref, crit })` (`{ grade, z }`; flagged above = 1),
`expectedRank(E, { w })` (weighted expected rank Σ_k w_k {1 + Σ_{j≠i} e[k][i][j]} as `postrank_expected_rank()`).

## simulate.ts (Step 2.10)
`simulateEstimates(truth, se, count, seed)`, `league30()` (SR-06 specification), `drawLeague(seed)`,
`normalPosterior(est, se, { priorMean, priorSd })` (`{ mean, sd, shrink }`), `normalInterval(mean, sd, level)`,
`expectedMisorderedPairs(theta, se, { priorSd })`, `misorderedPairs(a, b)`, `topKOverlap(a, b, k)`,
`extremeCounts(score, group, k)`, `rankSummaries(law)`, `rankSummariesMC(means, sds, S, seed)`, `krwExample1Band(tau)`,
`gaussianDraws(means, sds, S, seed)`, `mcse(trace)` (sample SD with divisor S − 1 over √S, as `postrank_mc_fragility()`),
`envelopeRadius(M, S, alpha, form)` (`"package"`: √(log(2M/α)/(2S)); `"book"`: √(log(4M/α)/(2S))),
`fragilePairs(draws, { tau, w, z = 2 })` (package rule |min(ebar_ij, ebar_ji) − τ| < z·MCSE of the weighted indicator trace),
`finiteLawDraws(probs, S, seed)` (Int32Array of S state indices by the strict cumulative rule on `uniforms(seed, S)`; Step 6.14).

## mip.ts (Step 2.11; solver bundle only)
`mipSolve(E, { tau, w, timeLimit })` → `{ grade, status, upper, lower, gap, seconds, label: "optimal-within-solver-tolerances" }`
for the unrestricted family; the objective carries the offset Σ_{i≠j}(ebar_ij − τ) so that `upper` is the report's risk
(CONTRACT 6.3). τ changes update only the objective of a persistent model.

## Step 2.4–2.5 implementation notes (recorded 2026-10-31)
- Sums are compensated (Neumaier); parity allows about 1e-15 relative on sums.
- `weakRelation` returns `{ z, complete, transitive }` with a NaN diagonal; `finiteLawPairwise` returns `{ ids, criteria, e, pi, t }`.
- `krwRisk` returns a number and accepts λ in [0, 1] (λ = 0 gives DR).
- `reportCardRows(g, summaries, sort)`: `summaries = { ids?, expectedRank?, mean? }`, default sort `expected_rank`; remaining ties by unit id (code-point order, as R radix sort).
- Conveniences: one common SD; n-vectors when K = 1; `probs = null` means equal weights; default ids A, B, … then U01, U02, ….
- Not in the API (left out deliberately): `errorMatrix` (use `errorArray`), `drawTruth` (Step 2.10 `gaussianDraws`), composite-target pair probabilities (P-04 uses known states only), KRW relabelling d_i = G + 1 − g_i (a G-09 table entry, not a function).

## Simulated league specification (SR-06; used by `league30` and `drawLeague`)
- Units U01 … U30 (index i = 1 … 30). Size cycles 16, 64, 256 starting at U01 (U01 = 16, U02 = 64, U03 = 256, U04 = 16, …);
  group "small" / "medium" / "large"; SE_i = 0.8/√size_i = .20, .10, .05.
- True values (no randomness): r_i = (19 · i) mod 31 (a permutation of 1 … 30); θ_i = .15 · Φ⁻¹((r_i − .5)/30).
- Estimates for seed s: z = `normals(s, 30)` in unit order; θ̂_i = θ_i + SE_i · z_i. Default seed 20261030; replay r
  uses seed 20261030 + r.
- Teaching posterior: normal–normal with prior mean 0 and prior SD σ (default .15): shrink B_i = σ²/(σ² + SE_i²),
  posterior mean B_i θ̂_i, posterior SD √(B_i) · SE_i.
- `league30()` returns `{ ids, size, group, se, theta, rank }`; `drawLeague(seed)` returns `{ seed, estimate }`.

## Step 2.6–2.7 implementation notes (recorded 2026-10-31)
- `reportCloud` returns `{ byN: [{ N, minEw, maxEw, count, minGrade, maxGrade }], points? }`; points only when the family has ≤ 5,000 reports.
- `exactOptimum` also returns `empty: false, N, G, Ew, E, EoverN, evaluation, tieTol`; with budgets `family.size` counts the reports meeting the budgets and `family.baseSize` is the base family size.
- `tauPath` rows: `{ tauFrom, tauTo, grade, N, G, Ew, E, EoverN (per criterion), EwOverN, riskFrom, riskTo }`.
- `fixedOrderDP` options add `tieTol`; returns `cuts` (unit positions), `blockCuts` (package `cuts`), `saving`, `family`; an empty family throws (as `postrank_cuts`). DP ties within 1e-12 on the risk scale → fewer grades, then the earlier cut (the package uses exact equality).
- `supportingVertex` returns `{ vertex, vertices, value }`; hull vertices exclude points on an edge (1e-12 relative) and carry the lexicographically first report at that N.
- `ENUMERATION_BUDGET` is exported (n ≤20 and size ≤600,000).
- Timings (Node 25.8.1, arm64): exactOptimum n = 8 all (545,835) 28 ms; n = 12 at most 3 (523,251) 26 ms; fixedOrderDP n = 100, ≤ 5 grades 0.9 ms; orderHull n = 100 33 ms.

## Step 2.8–2.10 conventions (fixed 2026-10-31)
- `gaussianDraws(means, sds, S, seed)`: z = `normals(seed, S·n·K)` consumed s-major, then unit, then criterion:
  θ[s][i][k] = means[i][k] + sds[i][k]·z[(s·n + i)·K + k]. `rankSummariesMC` uses it with K = 1.
  `simulateEstimates(truth, se, count, seed)` = truth + se·`normals(seed, count)`.
- `league30().rank` = r_i (larger means larger θ). `evidenceFlags`: strict |z| > crit, canonical grades.
- `tierGrades` follows `postrank_cuts(rule = "quantile")` exactly, including the merging of every tier a tied run
  straddles (transitively). The theory book (ch. 17) gives tied scores their minimum position without merging; the
  difference matters only with tied scores (no course page has them) and is author check AC-E01.
- Expected rank uses the weak error (ties count as wrong), as `postrank_expected_rank()`; book ch. 5 uses the strict
  rank. Course inputs are tie-free except P-10 (author check AC-E02).
- `estimandCosts`: `multiplier[k]` multiplies criterion k before the composite. `weightCrossing` returns null outside (0, 1).
  `envelopeRadius` is not capped. `mcse` of one draw is null; divisor S − 1 (package).
- `krwExample1Band(tau)` is empty when the pairwise rule would not state 1 above 3 (π13 < 1 − τ, as at τ = .05).
- `rankSummaries(law)`: `law = { states[s][i], probs }`; `pTop[k][i]` = Pr(unit i among the top k + 1).
  `extremeCounts(score, group, k)` returns counts keyed by group name.

## Step 2.8–2.10 implementation notes (recorded 2026-10-31)
- `expectedMisorderedPairs` with a prior uses the signed form Φ(−sign(θ_i − θ_j)(B_iθ_i − B_jθ_j)/√(B_i²SE_i² + B_j²SE_j²))
  (shrinkage can reverse a pair's expected order): 80.69 for the league posterior-mean order, 88.12 for the estimates.
- `minimaxChoice` includes every criterion by default (package `minimax_criteria = NULL`; theory book ch. 13); pass
  `criteria` to restrict.
- `estimandCosts` returns `{ pair, c, criterionLoss: { costs, best }, compositeLoss: { costs, best }, criterionE, compositeE }`.
- `rankSummaries` returns `{ n, means, expectedRank, rankProbs, pTop, tieFree }` (strict rank, ties share the best place).
- `misorderedPairs` → `{ count, pairs }`; `topKOverlap` → `{ count, members }`; `extremeCounts` → `{ k, top, bottom, total }`;
  `krwExample1Band` → `{ tau, empty, lower, upper, pi13, states13 }`; `fragilePairs` lists pairs in the package's order.
- Extras: `direction` on `strictOrder`/`tierGrades`; `labels` in `evidenceFlags`; `screenMargin`, `grade`, `ids` on
  `fragilePairs`; `members` in `budgetFamily`; `priorMean`; `LEAGUE_SEED`.
- Timings: commonalityCost six sites cap 3 0.18 ms; fragilePairs n = 30, S = 4,000, K = 3 about 29 ms.

## Step 2.11 implementation notes (recorded 2026-10-31)
- `mipSolve` lives in `js/bundles/solver.js` (browser: `window.PRX_SOLVER = { mipSolve, ready }`, blob-URL Worker, returns a
  Promise) and `js/bundles/solver-node.mjs` (Node, returns the result directly); `engine/src/mip.ts` exports
  `createMipSolver(highs)` and is not part of `js/pr-core.js` (whose bytes are unchanged).
- `label` is "optimal-within-solver-tolerances" only when `status === "optimal"`; otherwise null (never call a non-optimal
  result optimal). Extra fields: `family`, `statusCode`, `reused`, `objective`, `bound`, `offset`, `nodes`, `evaluation`,
  `N`, `G`, `Ew`, `E`, `EoverN`. A time limit without an incumbent returns null `upper`, `lower`, `gap`.
- HiGHS has its own tie tolerance (about 1e-7 in the raw objective): near breakpoints it can return the runner-up, so
  widgets compare risk, not grade, between the solver and `exactOptimum`.
- Sizes: solver.js 4.89 MB, solver-node.mjs 4.82 MB (outside the 300 KB widget-bundle budget by design, CONTRACT 8.7).
  Chrome Worker from file://: n = 10 40–51 ms first solve, n = 20 91–116 ms, n = 25 139–178 ms; τ change reuses the model.

## Step 2.12 changes after the engine review (recorded 2026-10-31; the numerical specification)
`engine/README.md` is authoritative for return shapes; this list records what changed relative to the sections above.
- Every options object rejects unknown keys (naming them); a number where options belong throws "options object expected".
- Order families: `exactOptimum` picks `grade` by the package rule (fewer grades, then the earlier cut), like
  `fixedOrderDP`; `fixedOrderDP` returns `grades`, `gradesOrder`, `tieCount`, `containsAllWithheld`; `tieTol: 0` gives the
  package's exact-equality choice. `fixedOrderDP`/`orderHull` accept `family: { kind: "order", … }`, top-level keys, or
  `scores` (+ `direction`, `ids`); new export `scoreOrder(scores, { direction, ids })` → `{ order, blocks }`.
- `maxTies` (default 100) and `tieCount` on `exactOptimum`, `minimaxChoice`, `weightPath`, `commonalityCost`,
  `budgetFamily`, `tauPath`.
- `family.size` is a number up to 2^53, otherwise a decimal string; `sizeExact` (BigInt, non-enumerable).
- Empty families return `{ empty: true, family, containsAllWithheld: false, label }` everywhere.
- `tauPath` returns `{ intervals, endpointOptima, endpointTieCount, family, … }` (keeps a zero-length interval at 1/2).
- New `weightBreakpoints(E, { tau, family, tieTol })` → `{ intervals, breakpoints, … }` (K = 2).
- `envelopeRadius(M, S, alpha, form, { K = 1 })`; book form √(log(4MK/α)/(2S)).
- `estimandCosts` option `multiplier` (was `scale`); `krwRisk(g, E, { lambda, t })` throws for tie laws;
  `conflictPairs` compares e_ij with e_ji.
- Budgets: `ENUMERATION_BUDGET` = n ≤ 20 and ≤ 600,000 reports; `ORDER_HULL_BUDGET` (≤ 150 units uncapped, ≤ 5·10⁷ cells).
- One risk-scale `tieTol` (default 1e-12) for every tie test; `supportingVertex(hull, tau, { tieTol, M })`.
- Formatters take `(value, options)`: do not pass them directly to `Array#map` (the index would land in options).

## Step 5.14: Part 1 summaries (recorded 2026-10-31)
Seven functions give the numbers that Part 1 widgets used to compute themselves a home in the engine
(the numerical specification). `summaryStats`, `meanSquaredDistance`, `fartherCount`, `intervalOverlapTally` and
`rankIntervals` live in `summaries.ts`; `leagueReplays` in `simulate.ts`; `unitRelationCounts` in `report.ts`. Each
reproduces the widget's former computation exactly (engine tests `tests/summaries.test.ts` keep the former widget
code as the reference). Indices are 0-based; an R oracle adds 1 on the way in and subtracts it on the way out.
Inputs are checked: vectors must be nonempty arrays of finite numbers of the stated lengths; options objects reject
unknown keys (CONTRACT 7.4). Independent base-R rows now cover these functions in oracle-summaries and
oracle-simulate; verification/parity-exempt.json is empty.

### `summaryStats(values)` → `{ n, mean, sd }`
- `n` = length; `mean` = R `mean(values)`: s = Σx_i/n (left-to-right double sum), then s + Σ(x_i − s)/n (one
  correction pass; R accumulates in long double, so the two agree to about 1 ulp); `sd` = √(Σ(x_i − mean)²/(n − 1))
  with the corrected mean (R `sd(values)`), `null` when n = 1 (R gives NA). Parity tolerance: rel 1e-14.
- L-04 frozen draw (`drawLeague(20261030).estimate`): sd .16206975093452108; θ (`league30().theta`): sd
  .14937466480710787; posterior means at prior SD .15: .09819488199364021, at .05: .036601609710443433.

### `meanSquaredDistance(a, b)` → number
- (1/n) Σ_i (a_i − b_i)², the sum compensated (Neumaier); R `mean((a - b)^2)`. a and b must have the same length.
  Parity tolerance rel 1e-14.
- L-04: estimates vs θ .016346498404655223; posterior means (prior SD .15) vs θ .009579415799948237; (prior SD .05)
  .014820079478793775.

### `fartherCount(estimates, posteriorMeans, truth)` → `{ count, flags, units }`
- `flags[i]` = |m_i − θ_i| > |y_i − θ_i| with y = estimates, m = posteriorMeans, θ = truth (strict: an equal
  distance is not farther); `units` = the indices i with `flags[i]` true, ascending (R: `which(...) - 1`);
  `count` = length of `units`. Exact comparisons (the league's smallest margin is 9.1e-4 at prior SD .15).
- L-04: 14 units at prior SD .15 (U01, U03, U06, U08, U13, U15, U16, U18, U21, U23, U24, U26, U27, U29), 17 at .05
  (U01, U02, U03, U05, U06, U08, U13, U15, U16, U17, U18, U21, U23, U24, U26, U27, U29).

### `intervalOverlapTally(lower, upper, pi, { threshold = .9 })`
→ `{ n, M, threshold, apart, overlapping, high, low, pairs: [{ i, j, first, second, pi, overlap, class }], best }`
- `lower`, `upper`: interval ends, length n ≥ 2, lower[i] ≤ upper[i]. `pi`: n × n with pi[i][j] = Pr(θ_i > θ_j)
  for i ≠ j, each in [0, 1] (the diagonal is not read; `directionMatrix(means, sds)` gives it). threshold in [0, 1].
- For each pair i < j, in the order (0, 1), (0, 2), …, (0, n − 1), (1, 2), … (row-major upper triangle):
  `overlap` = max(lower_i, lower_j) < min(upper_i, upper_j) (strict: touching intervals do not overlap);
  if pi[i][j] ≥ pi[j][i] then first = i, second = j, p = pi[i][j], else first = j, second = i, p = pi[j][i];
  row `pi` = p; `class` = "apart" if not overlap, else "high" if p > threshold (strict), else "low".
- Counts: `apart`, `high`, `low` (sum M = n(n − 1)/2), `overlapping` = high + low.
- `best` = `{ i, j, first, second, pi }` of the overlapping pair with the largest p; on equal p the earliest pair in
  the order above (update only when strictly larger); `null` when no pair overlaps.
- Note (kept from the widget): the widget oriented each pair by the posterior-mean order (`strictOrder`) and
  tested lower[higher] < upper[lower]. For central normal intervals (each contains its mean) and threshold ≥ .5
  that is the same classification, the same first unit and the same pick; the symmetric test above is the general
  definition.
- League (frozen draw, prior SD .15, `normalInterval(mean, sd, level)`, threshold .9): level .90 → apart 36,
  overlapping 399, high 88, low 311, best first U13 (index 12), second U05 (4), pi .98781943458425; level .95 →
  22, 413, 102, 311, best U03 (2) over U15 (14), .9969515549415986. Prior SD .05: .90 → 8, 427, 58, 369, best U30
  over U18 .9895841657726948; .95 → 2, 433, 64, 369, best U06 over U18 .9963746342103851. Smallest margins at
  prior SD .15: overlap 8.9e-5, |p − .9| 4.1e-4, so the counts do not depend on the last bits of qnorm or pnorm.

### `rankIntervals(pTop, { level = .9, tieTol = 1e-12 })` → `{ level, tail, lower, upper }`
- `pTop[r][i]` = Pr(R_i ≤ r + 1), r-major (R rows × n units), as `rankSummaries`/`rankSummariesMC` return it
  (cumulative, nondecreasing in r; the last row is 1 up to rounding). level in (0, 1), tieTol ≥ 0.
- tail = (1 − level)/2 in double arithmetic (level .9: 0.04999999999999999); loCut = tail − tieTol;
  hiCut = (1 − tail) − tieTol (evaluate 1 − tail first). `lower[i]` = smallest r (1-based) with
  pTop[r − 1][i] ≥ loCut; `upper[i]` = smallest r with pTop[r − 1][i] ≥ hiCut; `null` when no row reaches the cut.
- Exact hits matter: a Monte Carlo share of 4,000 draws such as 200/4,000 = .05 or 3,800/4,000 = .95 lies exactly
  on a cut and counts (≥, with the tieTol slack). The league Monte Carlo table has values within 1.4e-17 of a cut,
  so an R oracle must use the same shares (count/S, exact) and the same cut expressions.
- Ch. 19 law (`rankSummaries({ states: [[20, 4, 3], [0, 4, 3]], probs: [.3, .7] })`): lower [1, 1, 2], upper
  [3, 2, 3]. League posterior at prior SD .15 (`rankSummariesMC(mean, sd, 4000, 1)`): lower
  [2, 12, 3, 2, 23, 3, 4, 1, 9, 1, 10, 14, 1, 7, 16, 1, 5, 22, 5, 16, 1, 4, 7, 4, 4, 1, 6, 9, 1, 5], upper
  [27, 29, 15, 28, 30, 16, 29, 16, 22, 24, 29, 26, 24, 27, 27, 27, 26, 30, 29, 30, 10, 29, 27, 17, 29, 11, 20, 30, 18,
  19] (U01–U30).

### `leagueReplays(seed = 20261030, { replays = 20, k = 5, topK = 10 })`
→ `{ seed, replays, k, topK, seeds, draws: [{ r, seed, estimate, extreme, topOverlap, misordered }], mean }`
- seed: an integer (the stream reduces it mod 2^32); replays ≥ 1, k ≥ 0, topK ≥ 0 integers.
- For r = 1, …, R: seed_r = seed + r (the first draw, `seed` itself, is not a replay); estimate = `drawLeague(seed_r)
  .estimate`; extreme = `extremeCounts(estimate, league30().group, k)` (`{ k, top, bottom, total }`, each keyed small,
  medium, large); topOverlap = `topKOverlap(estimate, league30().theta, topK).count`; misordered =
  `misorderedPairs(estimate, league30().theta).count`. These are the existing oracle-checked definitions (ties by
  index; the league has none).
- `seeds` = [seed_1, …, seed_R]; `mean` = `{ extreme: { small, medium, large } (Σ_r total[g] / R), topOverlap:
  Σ_r topOverlap / R, misordered: Σ_r misordered / R }` (integer sums, one division).
- L-03 (seed 20261030): mean.extreme 4.35, 3.65, 2; topOverlap 7.45; misordered 83.9. Per replay r = 1…20 as
  small/medium/large/topOverlap/misordered: 6/2/2/6/116, 4/5/1/8/90, 4/4/2/7/80, 5/2/3/8/76, 4/3/3/7/98, 6/3/1/6/82,
  3/4/3/8/87, 3/4/3/8/65, 5/3/2/8/73, 6/3/1/8/94, 2/5/3/9/62, 5/4/1/9/73, 5/3/2/6/97, 6/3/1/7/86, 3/5/2/7/105,
  4/4/2/8/79, 4/4/2/6/97, 3/5/2/8/70, 5/3/2/7/77, 4/4/2/8/71.

### `unitRelationCounts(g)` → `{ n, partners, above, below, stated, withheld }`
- g: integer grade labels (any integers; canonicalised first, smallest label = grade 1), n ≥ 1.
- above[i] = #{j : g_i < g_j} (i stated above j); below[i] = #{j : g_i > g_j}; stated[i] = above[i] + below[i];
  withheld[i] = #{j ≠ i : g_j = g_i} (the other units of its grade); partners = n − 1 = stated[i] + withheld[i].
  These are the counts of +1, −1, nonzero and off-diagonal 0 in row i of `relations(g)`.
- Example: g = (2, 1, 2, 3, 1) → above (1, 3, 1, 0, 3), below (2, 0, 2, 4, 0), stated (3, 3, 3, 4, 3), withheld
  (1, 1, 1, 0, 1). KRW cards (`data/released/case-krw.json` tables.reports, 97 firms): race card, row 14 stated 95,
  withheld 1; row 61 95, 1; gender card, row 94 (alone in grade 1) stated 96, withheld 0; partners 96.

### Golden rows the R batch should write (suggested shapes)
One group (for example `oracle-summaries`, `uses_postrank: false`) with `args.fn` naming the function, so the
coverage check finds it. Compared fields, as an adapter would return them:
`summaryStats` { n, mean, sd }; `meanSquaredDistance` { value }; `fartherCount` { count, units } (0-based) and
`flags`; `intervalOverlapTally` { apart, overlapping, high, low, best: { first, second, pi } or null, classes:
pairs[].class in pair order }; `rankIntervals` { lower, upper } (null for NA); `leagueReplays` { seeds,
extremeTotal: draws[].extreme.total, extremeTop, extremeBottom, topOverlap: draws[].topOverlap, misordered:
draws[].misordered, mean }; `unitRelationCounts` { partners, above, below, stated, withheld }. Rows worth having: the
L-04 league vectors at prior SD .15 and .05; the L-06 tallies at prior SD .15 and .05, levels .90 and .95, with the
widget's inputs (`normalInterval` ends and `directionMatrix`) recomputed in R; the L-09 rank intervals of the ch. 19
law and of the league Monte Carlo table (the R stream reimplementation, `r-export/_rng.R`); `leagueReplays` at seed
20261030 (R = 20) and one other seed with other k and topK; `unitRelationCounts` of both KRW cards and a few small
vectors with nonconsecutive labels.

### Registry keys added in Step 5.14 (numbers/spec fragments)
- `part1-l04.json`: `league.default.raw.msd`, `league.default.prior15.pm.msd`, `league.default.prior05.pm.msd`,
  `league.default.raw.sd`, `league.default.prior15.pm.sd`, `league.default.prior05.pm.sd`, `league.spec.theta.sd`,
  `league.default.prior15.farther`, `league.default.prior05.farther`.
- `part1-l06.json`: `league.default.prior15.level{90,95}.tally.{apart,overlapping,high,low,best.pi}` (inputs
  `l06.pi15`, `l06.tally15.90`, `l06.tally15.95`).
- `part1-l03.json`: input `l03.replays` (`leagueReplays`) replaces the per-replay inputs and the `rankSummaries`
  route of `league.replay20.avg.*` (same values); new `league.replay.rNN.{ext10small,ext10medium,ext10large,
  top10overlap,misordered}` for NN = 01…20.
- `part1-l09.json`: `tb19.law3.ri90.{lower,upper}`, `league.default.prior15.mc4000.s1.ri90.{lower,upper}` (vectors).
- `part1-l01.json`: `krw.race.card.partners`, `krw.gender.card.partners`, `krw.race.esttop.{stated,withheld}`,
  `krw.race.meantop.{stated,withheld}`, `krw.gender.esttop.{stated,withheld}`.

## Step 6.14: Part 2 helpers (recorded 2026-10-31)
Two functions give the numbers that Part 2 widgets computed themselves a home in the engine
(the numerical specification): G-05 drew an order of the theory book's three-unit law from the engine's uniforms
with its own cumulative rule, and S-02 counted the confident pairs of the KRW heat map in a loop. `finiteLawDraws`
lives in `simulate.ts`, `confidentPairs` in `risk.ts`. Indices are 0-based (an R oracle adds 1 on the way in and
subtracts it on the way out). Inputs are checked as elsewhere; options objects reject unknown keys (CONTRACT 7.4).
Independent base-R rows now cover both in oracle-simulate and oracle-report-risk; neither is parity-exempt.

### `finiteLawDraws(probs, S, seed)` → `Int32Array` of length S
- `probs`: a nonempty array of finite numbers in [0, 1] (a finite law's state probabilities, in state order; they
  need not sum exactly to 1). `S`: an integer ≥ 0. `seed`: an integer (reduced mod 2^32 as in `uniforms`).
- u = `uniforms(seed, S)`. Cumulative sums c_k = c_{k−1} + p_k (left to right, double arithmetic, c_0 = p_0).
  Draw s is the smallest k with u_s < c_k (strict); when no k qualifies (u_s ≥ the last sum, possible only when the
  sums fall short of 1), the last index K − 1.
- Ch. 10 law (probabilities 3/5, 3/20, 3/20, 1/10 for orders ABC, ACB, BAC, CBA), seed 1: the first five draws and
  the order shares over 100 draws are the expected values; an R oracle uses the same uniforms (`uniforms-seed1-100`
  rows exist in `oracle-stream`) and the same strict comparison.

### `confidentPairs(g, E, { tau, w })` → `{ count, withheld, stated, pairs }`
- `g`: a grade vector of length n; `E`: criterion-major errors `e[k][i][j]` as elsewhere, combined with weights `w`
  to ebar_ij = Σ_k w_k e_k[i][j] (K = 1: w = [1]); `tau` in (0, 1/2].
- A pair i < j is **confident** when min(ebar_ij, ebar_ji) < τ (strict): one of its two directions is wrong with
  probability below τ. `count` = confident pairs; `withheld` = confident pairs with g_i = g_j (a shared grade);
  `stated` = count − withheld. `pairs` = `[{ i, j, withheld }]` in row-major upper-triangle order (0, 1), (0, 2), …
- The S-02 heat map at τ = .20 on KRW's released race array and card: count 1,575, withheld 575 (the card's
  `statedAbove` count is reported beside it, not here).

## Step 7.1: Part 3 helpers (recorded 2026-10-31)
Six functions give Part 3's widget numbers a home in the engine (the numerical specification §9). Indices are
0-based; an R oracle adds 1 on the way in and subtracts it on the way out. Grade vectors go through `reportGrade`
(canonical labels, length n ≥ 2); `E` is criterion-major `e[k][i][j]` combined with weights `w` to
ebar_ij = Σ_k w_k e_k[i][j] as in `statedAbove` (K = 1: w = [1]). Options objects reject unknown keys.
Independent base-R rows cover all six in oracle-part3; none is parity-exempt.

### `statedAgainst(g, scores, { direction = "descending" })` → `{ count, pairs, units }` (report.ts)
- `scores`: n finite numbers. With "descending" a larger score is the better (higher) position; with "ascending" a
  smaller one is.
- A pair i < j (row-major order (0, 1), (0, 2), …) is **stated against the scores** when the report states a
  direction (g_i ≠ g_j) and the scores order the two the other way, strictly: for "descending", g_i < g_j (i stated
  above j) and score_i < score_j, or g_j < g_i and score_j < score_i ("ascending": swap the score comparison). Equal
  scores are never "against".
- `pairs`: `[{ above, below }]` for each such pair (above = the unit the report puts higher), in pair order; `count` =
  their number; `units`: ascending indices of the units that appear as `below` in some pair (a unit with a better
  score than some unit stated above it).

### `relationChange(g0, g1, E = null, { w })` → `{ M, nSame, nNewDisclosed, nNewWithheld, nReversed, agreement, pairs }` (report.ts)
- For each pair i < j: r0 = sign(g0_j − g0_i), r1 = sign(g1_j − g1_i) (+1: i above j; 0: withheld).
  Same when r0 = r1; newly disclosed when r0 = 0 ≠ r1; newly withheld when r0 ≠ 0 = r1; reversed when r0 = −r1 ≠ 0.
- `agreement` = nSame / M. `pairs` = `[{ i, j, from, to, error }]` for the changed pairs only, in pair order, with
  `from`/`to` in {"above", "below", "withheld"} (i's relation to j) and `error` = the stated error under g1 (ebar_ij
  if g1 states i above j, ebar_ji if j above i, null if withheld or when E is null). The package's
  `postrank_compare(...)$relations` reports the same four counts.

### `bestReports(E, { tau, w, family, k = 1, stating = [], tieTol = 1e-12 })` → `{ family: { name, size }, matched, reports }` (optimize.ts)
- Enumerates the family as `exactOptimum` does (same family objects, same enumerable budget); keeps the reports that
  state every listed pair: `stating` is a list of `[i, j]`, each meaning "i above j" (g_i < g_j).
- Sorted by risk ascending; two risks within tieTol·(1 + |risk|) keep enumeration order (lexicographic in canonical
  grade vectors). `reports` = the first k: `[{ grade, risk, N, Ew }]`; `matched` = number of reports that passed the
  `stating` filter. k ≥ 1 integer. Risk as `evaluateReport`.

### `reportsAtN(E, { w, family, N, k = 1, tieTol = 1e-12 })` → `{ family, N, count, reports }` (frontier.ts)
- The reports of the family with exactly N stated pairs: `count` = their number; `reports` = the k with the smallest
  Ew, `[{ grade, Ew }]`, ties as in `bestReports` (tolerance on Ew). Empty `reports` when count = 0.

### `cutGrade(n, cuts, { order = null, blocks = null })` → `Int8Array` grade vector (report.ts)
- `order`: a permutation of 0…n−1 (default identity), listing units from the top position down. `cuts`: strictly
  increasing integers in 1…n−1; a cut c falls after the c-th unit of the order. Grade of the unit at position p
  (1-based) = 1 + number of cuts < p. Example: n 12, cuts [4, 8] → sizes 4/4/4.
- `blocks` (optional): a list of position ranges `[from, to]` (1-based, inclusive) that must share a grade; a cut with
  from ≤ c < to throws a RangeError naming the block.

### `ruleGap(g, E, { w, hull, tieTol = 1e-12 })` → `{ N, Ew, H, gap, psi, lower, upper, onFrontier }` (frontier.ts)
- `hull`: vertices as `lowerHull` returns them (ascending N). N, Ew from `evaluateReport(g, E, { w })` (Ew = Σ w_k E_k).
  H = the lower hull at N: if a vertex has that N, H = its Ew, psi = null, lower = upper = that vertex; else the
  adjacent vertices (N_a < N < N_b), psi = (N_b − N)/(N_b − N_a) (weight on the lower vertex),
  H = psi·Ew_a + (1 − psi)·Ew_b. gap = Ew − H, set to 0 when |Ew − H| ≤ tieTol·M; onFrontier = (gap === 0). N outside
  the hull's range throws a RangeError.

### Step 7.1 implementation notes (recorded 2026-10-31)
- **Tolerant order** (`bestReports`, `reportsAtN`): "within tieTol·(1 + |x|) keep enumeration order" is made exact as a
  greedy order: repeatedly take, among the reports not yet listed, the first in enumeration order whose key x (risk,
  or Ew for `reportsAtN`) is within tieTol·(1 + |m|) of the smallest remaining key m. Exact ties and separations
  larger than the tolerance give the plain sort by (key, enumeration order); `k = 1` gives `exactOptimum`'s `grade`
  for the non-order families. The walk keys rank the reports; the listed `risk`, `N`, `Ew` are `evaluateReport`'s.
  One pass: only reports within the tolerance of the k-th smallest key so far are kept.
- Extra fields: `tieTol` and `label: "exact-within-family"` on `bestReports` and `reportsAtN`; `family` is the full
  family label `{ name, words, size }` (+ non-enumerable `sizeExact`). An empty family (e.g. exactly 4 grades on 3
  units) gives `matched`/`count` 0 and empty `reports`, not an `{ empty: true }` object; N above M gives count 0;
  N must be an integer ≥ 0. The enumeration budget is `exactOptimum`'s (above it the functions throw).
- `relationChange`: `w` without `E` throws ("w applies only together with E"); `E = undefined` is the same as null.
  The reports must have the same length (and E's n when given).
- `cutGrade`: n ≥ 2, at most 126 cuts (Int8Array); `order` and `blocks` may be null; a block must satisfy
  1 ≤ from ≤ to ≤ n (blocks are positions along the order, not unit indices).
- `ruleGap`: Ew and N come from `evaluateReport(g, E, { tau: 1/2, w })` (Ew does not depend on τ); `hull` is checked
  as in `supportingVertex` (nonempty, finite, increasing N); the tolerance is |Ew − H| ≤ tieTol·M with M of the
  report (a gap below H beyond the tolerance is returned as a negative number).
- CDE (12 schools, τ .20, at most 3 grades; `data/released/case-cde.json`): `bestReports(k = 3)` risks .0637745 (N
  45, 3/6/3), .0640869 ({A–F}/{G, H, I}/{J, K, L}, the best report stating F above I), .0640921 ({A, B, C}/{D, E,
  F}/{G–L}); `reportsAtN(N = 48)` count 34,650, Ew 1.828838 (the tertiles) and 1.908842; `cutGrade(12, [4, 8], { order:
  scoreOrder(mean).order })` = the released tertiles; `relationChange(optimum, tertiles, E)` 9 newly disclosed, 6
  newly withheld, 0 reversed, near-even stated errors .4389–.4779. Timings (Node 25.8.1, arm64): `bestReports` and
  `reportsAtN` over the 523,251 reports about 25–30 ms each.

## v3 helpers (Phase 2, Step 2.1)

Functions that the v3 apps of Parts 1 and 2 need and the engine did not have (the numerical specification, "Engine
functions the catalog needs"; the DP table of 2.16 is `fixedOrderDP`'s existing `trace`). The conventions of the earlier sections hold: units are 0-based, an ErrorArray is
`{ ids, criteria, e }` with `e[k][i][j]` the weak error of stating i above j on criterion k (NaN on the diagonal),
weights `w` are K nonnegative finite numbers summing to 1 within 1e−12 (K = 1 may omit `w`), options objects are
read or refused (an unknown key throws a TypeError naming it), and sums run in index order (i, then j, then k)
unless a function says otherwise. Results are plain objects of numbers, arrays and `null`; integer counts are
numbers. Each function below is checked by base-R oracle rows (`r-export/17_v3_helpers.R` →
`verification/golden/oracle-v3.json`, adapter `verification/parity.d/oracle-v3.mjs`), written from this section
alone.

### `topKOvershoot(estimate, truth, { k, side = "top", posterior = null })` (1.4) → `{ k, side, units, overshoot, posteriorOvershoot }`

The winner's curse for one draw. Order the units by `estimate`, largest first, equal estimates in index order (the
order of `extremeCounts`). `side = "top"`: `units` are the first k of that order; `"bottom"`: the last k, in that
order. `overshoot = (1/k) Σ_u (estimate[u] − truth[u])` over `units` in listed order; `posteriorOvershoot` the same
with `posterior[u]` in place of `estimate[u]`, or `null` without `posterior`.
Checks: `estimate`, `truth` (and `posterior`) finite arrays of one length n ≥ 1; `k` an integer in 1..n; `side` one
of the two strings.
Example: estimate (3, 1, 2, 2), truth (1, 1, 1, 1), k 2, top: units [0, 2], overshoot 1.5; bottom: units [3, 1],
overshoot 0.5. With posterior (2, 1, 1.5, 1.5): top posteriorOvershoot 0.75.

### `leagueOvershoot(seed = LEAGUE_SEED, { replays = 20, k = 3, side = "top", priorSd = .15 })` (1.4) → `{ seed, replays, k, side, priorSd, draws, mean }`

Replay r = 1..R uses `drawLeague(seed + r)` (the convention of `leagueReplays`), the teaching posterior
`normalPosterior(estimate, league30().se, { priorSd })` (prior mean 0) and the truth `league30().theta`. Each element
of `draws` is `{ r, seed, units, overshoot, posteriorOvershoot }` from `topKOvershoot`. `mean` =
`{ overshoot, posteriorOvershoot }`, arithmetic means over replays in replay order. `priorSd = Infinity` gives the
flat prior (posterior mean = estimate).
Checks: `seed` a safe integer; `replays` an integer ≥ 1; `k`, `side` as above; `priorSd` > 0.
Example (seed 20261030, k 3, top, prior SD .15): over 2,000 draws with seeds 20261030 + 0 … 1999 the means are
about .160 (estimate) and −.007 (posterior); the oracle rows fix exact values for R = 20.

### `expectedSquaredDistance(theta, se, { priorSd = .15, priorMean = 0 })` (1.6) → `{ perUnit, mean, rawMean }`

The closed-form expectation, over the estimate noise est_i = θ_i + SE_i z_i with fixed true values, of the squared
distance from the normal–normal posterior mean m_i = μ + B_i(est_i − μ) to θ_i, B_i = σ²/(σ² + SE_i²) (B_i = 1 when
σ = ∞):

  perUnit_i = ((1 − B_i)(μ − θ_i))² + B_i² SE_i²,  mean = (1/n) Σ_i perUnit_i,  rawMean = (1/n) Σ_i SE_i².

Checks: `theta`, `se` finite arrays of one length n ≥ 1, `se` ≥ 0; `priorSd` > 0 (Infinity allowed); `priorMean`
finite.
Example: the league (`league30()`): mean .019149 at σ .02, .008460 at .10, .007536 at .15, .008193 at .20; rawMean
.0175.

### `finiteLawMargins(states, probs)` (1.10) → `{ ids?, criteria?, margins }`

For a finite joint law (`states[s][i][k]`, `probs[s]`, as in `finiteLawPairwise`), the marginal law of each unit and
criterion: `margins[i][k] = { values, probs }`, `values` the distinct values of `states[s][i][k]` in ascending order
(equal means `===`), `probs[v]` the sum of the state probabilities with that value, summed in state order.
Checks: as `finiteLawPairwise` (probabilities nonnegative and summing to 1 within 1e−12).
Example: law 1 of chapter 9 with A and B each taking 0, 1, 2 with probability 1/3 has margins `{ values: [0, 1, 2],
probs: [1/3, 1/3, 1/3] }` for both units, under both laws.

### `majorityWins(E, { w, tieTol = 1e-12 })` (1.15) → `{ wins, ties, order, cycles, strictOrder }`

ē_ij = Σ_k w_k e_ijk. Unit i beats j when ē_ij < ē_ji − tieTol (stating i above j is less often wrong than the
reverse); the pair is a majority tie when |ē_ij − ē_ji| ≤ tieTol. `wins[i]` counts the units i beats, `ties[i]` the
units it ties with. `order` lists the units by `wins` descending, equal wins in index order. `cycles` counts the
unordered triples {a, b, c} whose three pairs are all strict and cyclic (a beats b, b beats c, c beats a, in either
orientation). `strictOrder` is true when no pair ties and `cycles` is 0 (then `order` is the majority order and wins
are n − 1, n − 2, …, 0).
Checks: an ErrorArray with n ≥ 2; `w` as usual; `tieTol` ≥ 0.
Example: the six sites, score A: wins (5, 4, 3, 2, 1, 0), no ties, 0 cycles, strictOrder true. On `case-krw.json`'s
race array the majority relation is a strict order; on its gender array there is one 3-cycle.

### `weightedRadius(eps, w)` and `regretBound({ N, Nstar, M, deltaW, eta = 0 })` (1.17, 2.17) → number and `{ evaluation, regret, uniform }`

Theory book ch. 15, "Coefficient perturbation and regret on a common domain": on the event that every coefficient
error on criterion k is at most ε_k, δ_w = Σ_k w_k ε_k (`weightedRadius`, summed in criterion order), and for
reports g (disclosing N) and the exact optimum g* (disclosing Nstar):

  evaluation = N·δ_w/M  (the bound on |R̂(g) − R(g)|),  regret = (N + Nstar)·δ_w/M + η,  uniform = 2δ_w + η.

Checks: `eps` nonnegative finite, one per criterion; `w` weights of the same length; `N`, `Nstar` integers in
0..M, `M` a positive integer; `deltaW`, `eta` ≥ 0 and finite.
Example: N 12, Nstar 9, M 15, δ_w .05, η 0: evaluation .04, regret .07, uniform .1.

### `twoStateChain({ p01, p10, S, chains = 1, seed })` (1.18) → `{ p01, p10, S, seed, pi1, chains }`

A stationary two-state Markov chain X_1, …, X_S ∈ {0, 1}: X_1 = 1 when u < π₁ = p01/(p01 + p10); then from state 0
the chain moves to 1 when u < p01, and from state 1 to 0 when u < p10 (strict comparisons). The uniforms are
`uniforms(seed, chains × S)`, chain c using entries c·S … c·S + S − 1 in order (the first for X_1). `chains` is an
array of `chains` arrays of 0/1 numbers.
Checks: 0 < p01, p10 ≤ 1 (so π₁ is defined); `S`, `chains` integers ≥ 1; `seed` a safe integer.

### `chainMeanVariance({ p01, p10, S })` (1.18) → `{ pi1, rho, variance, iidVariance, equivalentDraws, asymptoticEquivalent, noSwitch }`

Theory book ch. 15, "Finite-sample coefficient error in a stationary two-state chain", for the sample mean of X_b
started in stationarity: ρ = 1 − p01 − p10, Cov(X_b, X_{b+h}) = π₁(1 − π₁)ρ^h, and

  variance = π₁(1 − π₁)/S² · { S + 2 Σ_{h=1}^{S−1} (S − h) ρ^h }  (summed for h = 1, 2, …),
  iidVariance = π₁(1 − π₁)/S,  equivalentDraws = π₁(1 − π₁)/variance,  asymptoticEquivalent = S(1 − ρ)/(1 + ρ),
  noSwitch = (1 − π₁)(1 − p01)^(S−1) + π₁(1 − p10)^(S−1)  (the chance that all S states are equal).

`asymptoticEquivalent` is `null` when ρ = −1.
Checks: as `twoStateChain`.
Example (the book's): p01 = p10 = .01, S = 100: variance .1412459, iidVariance .0025, equivalentDraws 1.76996,
asymptoticEquivalent 1.010101, noSwitch .3697296.

### `wrongCountDistribution(g, states, probs, { w })` (2.8, and 4.13 later) → `{ N, values, probs, expected, pNone, pAllCriteriaRight, unionBound }`

The law of the realized weighted wrong count A = Σ_k w_k D_k of a fixed report g under a finite joint law, where
D_k(s) counts the stated directions i above j (g_i < g_j) with states[s][i][k] ≤ states[s][j][k] (postrank's weak
error: a tie is wrong). For each state, D_k is counted over pairs in index order and A summed in criterion order;
`values` are the distinct A in ascending order (equal means `===`) with `probs` summed in state order. `expected` =
Σ_s probs[s]·A(s). `pNone` = Pr(A = 0); `pAllCriteriaRight` = Pr(D_k = 0 for every k) (equal to `pNone` when every
weight is positive); `unionBound` = max(0, 1 − Σ_{stated (i, j)} Σ_k Pr(states[i][k] ≤ states[j][k])), the
Bonferroni lower bound on `pAllCriteriaRight`. With N = 0: `values` [0], `probs` [1], every probability 1.
Checks: g a grade vector of length n (positive integers); the law as in `finiteLawPairwise`; `w` as usual.
Example: chapter 19's three-unit law (A, B, C) with states (20, 4, 3) w.p. .3 and (0, 4, 3) w.p. .7 and the report
2/1/2 (B above A and C): D = 1 in the first state (B above A wrong), 0 in the second, so values [0, 1], probs
[.7, .3], expected .3, pNone .7, unionBound .7.

### `disclosedErrorEstimands(cases, { M, weights })` (2.19; extends the existing function)

`weights` (optional) gives each case a probability (nonnegative, finite, summing to 1 within 1e−12), the kernel of a
randomized report or a design over datasets (theory book ch. 16, "Averaging conventions for disclosed-error
fractions"). With weights p: ERR = Σ p·A / Σ p·N (null when Σ p·N = 0); meanFraction = Σ_{N>0} p·A/N / Σ_{N>0} p
(null when no case discloses); zeroImputed = Σ_{N>0} p·A/N; positiveFrequency = Σ_{N>0} p; meanDisclosure =
Σ p·N/M (null without M). Sums run in case order. Without `weights` the cases are equally likely (the current
behaviour, unchanged).
Example: cases (A, N) = (2, 2), (0, 3), (0, 0) with weights (1/2, 1/4, 1/4) and M 3: ERR 1/(7/4) = 4/7, meanFraction
(1/2)/(3/4) = 2/3, zeroImputed 1/2, positiveFrequency 3/4, meanDisclosure 7/12.

### `leagueGradingReplays(seed = LEAGUE_SEED, { replays = 20, priorSd = .15, tau = .2, cap = 3 })` (2.19; 3.11, 3.12 later) → `{ seed, replays, priorSd, tau, cap, draws, estimands }`

Replay r = 1..R: estimates `drawLeague(seed + r)`; the teaching posterior at `priorSd`; E = `errorArray` of the
posterior means and SDs (one criterion, larger is higher); the report = `fixedOrderDP` along the posterior-mean
order (descending, equal means in index order) with at most `cap` grades at `tau` (its package choice among ties);
then `evaluateReport` for the self-reported E, N, E/N and risk, and `realizedWrong` against `league30().theta` for
the realized wrong count D and D/N. Each draw: `{ r, seed, grade, N, E, EoverN, D, DoverN, risk }` (E/N and D/N null
when N = 0). `estimands` = `disclosedErrorEstimands` over the realized (A = D, N) of the replays, equally weighted,
with M = 435.
Checks: as `leagueOvershoot`; `tau` in (0, 1/2]; `cap` an integer 1..30.

### `largestStatedError(g, E, { w })` (2.13) → `{ e, i, j }` or `null`

The stated direction (g_i < g_j: i above j) with the largest weighted error ē_ij; equal errors: the first in (i, j)
index order. `null` when the report states nothing.
Example: the six sites, score A, report 1/1/2/2/3/3: { e: .0107781, i: 3, j: 4 } (D above E).

### `leastCertainPairs(E, { k = 10, w })` (1.13) → `[{ i, j, e, above }]`

The k unordered pairs i < j with the largest min(ē_ij, ē_ji) (the least certain direction first); equal values in
(i, j) index order. `e` = min(ē_ij, ē_ji); `above` = i when ē_ij ≤ ē_ji, else j (the more likely higher unit). k is
clamped to M.
Example: the six sites, score A, k 3: (C, D) e .3618 above C; (A, B) .1884 above A; (E, F) .1444 above E.

### `transformedMeans(law, { transform = "identity", k = 1, criterion = 0 })` (1.14) → `{ means, order }`

The posterior mean of a transformed target, to show that posterior means depend on the target's scale while pair
probabilities (and so expected ranks and grades) do not under a common increasing transform. `law` is either a
finite law `{ states, probs }` (as in `finiteLawPairwise`; `means[i] = Σ_s probs[s]·f(states[s][i][criterion])`,
summed in state order) or independent normal posteriors `{ means, sds }` (one criterion). `f` is θ (`"identity"`),
√θ (`"sqrt"`, needs θ ≥ 0), log θ (`"log"`, needs θ > 0) or exp(kθ) (`"exp"`). For normal posteriors only
`"identity"` (the means) and `"exp"` (the lognormal mean exp(k·m + k²·s²/2)) are allowed. `order` lists the units by
mean descending, equal means in index order.
Checks: a value outside the transform's support throws a RangeError naming the unit; `k` finite and nonzero;
`criterion` an integer in range.
Example: chapter 19's three-unit law (A is 20 with probability .3, else 0; B is 4; C is 3): identity means (6, 4, 3),
order [0, 1, 2]; sqrt means (1.341641, 2, 1.732051), order [1, 2, 0]. Normal m = 0, s = 1, exp with k = 1: 1.648721.

### `selectionOnDraws(draws, E, { tau, w, family })` (2.18) → `{ grade, N, inSample, exact, gap, epsilon, deltaW, bound, best, regret, regretBound }`

A report chosen on posterior draws and judged under the exact law (theory book ch. 15, "Coefficient perturbation and
regret on a common domain" and "Uniform bounds for optimization using the same draws"). Ê = `drawErrors(draws)`; the
chosen report ĝ is `exactOptimum(Ê, { tau, w, family }).grade` (the package's choice among ties);
`inSample` = R̂(ĝ) (risk under Ê), `exact` = R(ĝ) (risk under E), `gap` = inSample − exact (either sign).
`epsilon[k]` = max_{i≠j} |ê_ijk − e_ijk|, `deltaW` = Σ_k w_k·epsilon[k], `bound` = N(ĝ)·deltaW/M (so |gap| ≤ bound
always). `best` = the risk of `exactOptimum(E, { tau, w, family })`, `regret` = exact − best (≥ 0), `regretBound` =
(N(ĝ) + N(g*))·deltaW/M with g* that optimum.
Checks: `draws` S × n × K (S ≥ 1) matching E's n and K; the options as `exactOptimum` (the family must be
enumerable).
Example: units A, B; draws (A, B) = (1, 0), (1, 0), (0, 1), (1, 0), so ê(A above B) = 1/4; exact e(A above B) = .4;
τ .45: ĝ = A above B, inSample .25, exact .4, gap −.15, epsilon [.15], bound .15, best .4, regret 0, regretBound .3.

### `pairCertainty(E, { w, thresholds = [.9, .99] })` (1.6) → `{ M, thresholds, counts }`

How many directions the posterior is nearly sure of: `counts[t]` is the number of unordered pairs i < j with
min(ē_ij, ē_ji) < 1 − thresholds[t] (strict), the more likely direction having probability above the threshold.
Checks: an ErrorArray with n ≥ 2; thresholds in (1/2, 1), increasing.
Example: the six sites, score A, thresholds [.9, .99]: counts [12, 11] of M = 15.

### v3 helpers: readings fixed at Step 2.5

The TypeScript implementation (Step 2.2) and the base-R oracle (Step 2.3, `r-export/17_v3_helpers.R`, 185 rows in
`verification/golden/oracle-v3.json`) were written apart from this section and agree on every row (parity 0
failures, 0 exemptions). Where the text above left a choice, both follow these readings:

- `finiteLawMargins(states, probs, { ids, criteria })` takes the labels as an optional third argument (checked as in
  `finiteLawPairwise`) and returns them only when given. As everywhere, `probs = null` means equally likely states
  (exact counts over S), also for `wrongCountDistribution` and `transformedMeans`.
- `wrongCountDistribution`: A is a plain left-to-right sum over criteria and `values` merge only `===` equal sums,
  so with K ≥ 3 two mathematically equal counts can stay apart by one rounding (w = (.2, .3, .5): D = (1, 3, 2)
  gives 2.0999999999999996, D = (3, 0, 3) gives 2.1). With N = 0, `expected` is 0 and `probs` exactly [1].
  `unionBound` sums over every criterion, unweighted, zero-weight criteria included.
- `disclosedErrorEstimands` with `weights`: every case must be valid whatever its weight (a case with N = 0 has
  A = 0); `meanFraction` is null when Σ_{N>0} p = 0; with one common M, `meanDisclosure` = (Σ p·N)/M, one division.
- `leagueGradingReplays`: E, E/N, D and D/N of a draw are numbers (one criterion), not one-element arrays.
- `chainMeanVariance`: at ρ = −1 with even S the variance is exactly 0 and `equivalentDraws` is Infinity (null in
  JSON).
- `pairCertainty`: 1 − threshold is computed in double arithmetic, so at .99 an error of exactly .01 counts
  (1 − .99 = 0.010000000000000009).
- The 2,000-draw example of `leagueOvershoot` is `leagueOvershoot(20261029, { replays: 2000 })` (replays use seed + r).
- Checks added beyond the text: `leastCertainPairs` k a positive integer (then clamped to M); `pairCertainty`
  thresholds nonempty and strictly increasing; `majorityWins` tieTol finite; `wrongCountDistribution` grade labels
  positive integers and n ≥ 2; `selectionOnDraws` an empty family throws a RangeError; `expectedSquaredDistance`
  accepts one common SE.
- The weight check, the ErrorArray shape check and the weighted error ē now live in `pairwise.ts` (re-exported by
  `risk.ts`), so that the pairwise helpers do not import from `risk.ts`.

## v3 helpers: Part 1 supplement (Step 3.27)

What the Part 1 builders computed in their apps and the engine should provide (the numerical specification and the
builders' reports). The conventions of "v3 helpers (Phase 2, Step 2.1)" hold (0-based units, ErrorArrays, weights,
options read or refused, sums in index order, plain results). The TypeScript implementation and a base-R oracle are
written apart from this section; the oracle rows go to `verification/golden/oracle-v3p1.json` (adapter
`verification/parity.d/oracle-v3p1.mjs`), with the read-out pins listed at the end.

### `pairDifference(meanA, sdA, meanB, sdB, { corr = 0 })` (1.8, 1.9, 1.11, 1.13) → `{ mean, sd, z, pi }` (pairwise.ts)

The difference θ_A − θ_B of two normal posteriors with correlation ρ: `mean` = meanA − meanB, `sd` =
√(sdA·sdA + sdB·sdB − 2·ρ·sdA·sdB) (evaluated left to right), `z` = mean/sd, `pi` = Pr(θ_A > θ_B) = normalCdf(z)
(with ρ = 0 the value of `pairDirection`).
Checks: means finite; SDs finite and > 0; `corr` finite in [−1, 1]; a degenerate difference (sd = 0, e.g. ρ = 1 with
equal SDs) throws a RangeError.
Examples: (.30, .20, .10, .20) → mean .2 (in double .19999999999999998), sd .282842712474619, z .707106781186547,
pi .760249938906523; the same with corr .5 → sd .2, z 1, pi .841344746068543; (.30, .20, .10, .60) → sd
.632455532033676, z .316227766016838, pi .624085182977075; (.20, .20, .20, .40) → mean 0, z 0, pi .5;
(3.289707253902943, 1, 0, 1) → sd 1.4142135623731, z 2.32617430735335, pi .989995373141941.

### `normalCoverage(k)` (1.1, 1.2) → number (special.ts)

normalCdf(k) − normalCdf(−k), the chance that a normal estimate lies within k SEs of its mean. Checks: k ≥ 0, finite
or Infinity (→ 1). Examples: 0 → 0; 1 → .6826894921370859; 2 → .9544997361036416.

### `withinBand(est, se, { ref, crit = 1 })` (1.2) → `{ within, n, share, expected }` (simulate.ts)

z_i = (est_i − ref_i)/se_i as in `evidenceFlags`; `within` counts the units with |z_i| ≤ crit (the units
`evidenceFlags` leaves unflagged); `n` = the number of estimates; `share` = normalCoverage(crit); `expected` = n·share.
`ref` and `se` are a number or an array of length n. Checks: `est` finite, n ≥ 1; `se` finite and > 0; `ref` finite
(required); `crit` finite and ≥ 0.
Example: est (.5, .8, .1, .45), se .2, ref .5 → within 2 (z = 0, 1.5000000000000002, −2, −.25), n 4, share
.6826894921370859, expected 2.7307579685483434.

### `sharedMeanPosterior(est, se, { priorSd, meanSd = Infinity, priorMean = 0 })` (1.9) → `{ weight, muMean, muVar, means, sds, corr }` (simulate.ts)

The normal model est_i | θ_i ~ N(θ_i, se_i²), θ_i | μ ~ N(μ, σ²) independently, μ ~ N(μ₀, s_μ²) (σ = `priorSd`, s_μ =
`meanSd`, μ₀ = `priorMean`; `meanSd` = Infinity is a flat prior on μ). With v_i = σ² + se_i² and B_i = σ²/v_i
(`weight[i]`, the weight on the unit's own estimate):

  muVar = 1/(1/s_μ² + Σ_i 1/v_i),  muMean = muVar·(μ₀/s_μ² + Σ_i est_i/v_i)  (the s_μ terms are 0 when s_μ = ∞),
  means_i = (1 − B_i)·muMean + B_i·est_i,  var_i = σ²·se_i²/v_i + (1 − B_i)²·muVar,
  cov_ij = (1 − B_i)(1 − B_j)·muVar (i ≠ j),  sds_i = √var_i,  corr[i][j] = cov_ij/(sds_i·sds_j), 1 on the diagonal.

Sums in unit order. Checks: `est` finite, n ≥ 1; `se` finite and > 0 (a number or an array); `priorSd` finite and > 0;
`meanSd` > 0 (Infinity allowed); `priorMean` finite.
Examples: est (.30, .10), se .20, priorSd .10, meanSd .50 → weight (.2, .2), muMean 2/11, muVar 1/44, means
(.20545454545454547, .16545454545454547), sds .15015143870590966 each, corr 20/31; then `pairDifference` with that
corr gives pi .6240851829770754 (.5747073311990832 with corr 0). est (.30, .10, −.20), se (.10, .20, .40), priorSd .15,
flat μ → weight (.6923076923076923, .36, .12328767123287669), muMean .18631816715069377, muVar .01913923846402065,
means (.26502097450790574, .155243626976444, .13868989996773157), sds (.0934616275854064, .14912891092897734,
.18557185975765336), corr (0, 1) .2704120748654439, (0, 2) .29768225472223053, (1, 2) .38805007788997653.

### `claimsByDistance(g, E, { w })` (1.16) → `[{ distance, count, expected, max }]` (risk.ts)

`g` is a strict order: a grade vector whose grades are 1..n, each once (grade 1 on top). The claim "the unit with
grade a is above the unit with grade b" (a < b) has distance b − a and error ē = Σ_k w_k e_k[unit_a][unit_b]. For
d = 1, …, n − 1 in order: `count` = n − d, `expected` = the sum of the errors of the claims at distance d (summed for
a = 1, 2, …), `max` = the largest of them.
Checks: `g` a permutation of 1..n, n ≥ 2; an ErrorArray with n units; `w` as usual.
Examples: three units, g (1, 2, 3), e(0 above 1) .1, e(1 above 2) .3, e(0 above 2) .05 → [{ 1, 2, .4, .3 }, { 2, 1,
.05, .05 }]. The six sites, score A, ranked by posterior mean (A first): distance 1 → 5 claims, expected
.712080844765332, max .361836804915882 (C above D); 2 → 4, .00712677687335478, .00400497116494002; 3 → 3,
.000205523306237474, .000102687868070609; 4 → 2, 1.23152871637185e−9, 9.25287068693378e−10; 5 → 1, 7.68729897214026e−13 (the released array; a tail value, so parity compares it with a relative tolerance).

### `finiteLawCells(states, probs, { i, j, criterion = 0 })` (1.10) → `{ rowValues, colValues, cells }` (pairwise.ts)

The joint law of (θ_i, θ_j) on one criterion under a finite law (as `finiteLawPairwise`; `probs = null` means equally
likely states): `rowValues` the distinct values of states[s][i][criterion] ascending (equal means `===`), `colValues`
the same for j, `cells[r][c]` the sum of probs[s] over the states with that pair of values, summed in state order (0
where no state falls). Checks: as `finiteLawPairwise`; i ≠ j integers in range; `criterion` in range.
Example: chapter 9's law 1, states (A, B) = (0, 1), (1, 2), (2, 0) with probability 1/3 each → rowValues and colValues
(0, 1, 2), cells [[0, 1/3, 0], [0, 0, 1/3], [1/3, 0, 0]].

### `binomialMcse(e, S)` (1.17) → number (simulate.ts)

√(e·(1 − e)/S) (evaluated as written), the Monte Carlo SE of a share with exact value e over S independent draws: the
register's "exact-e approximation" (CR-152; the MCSE the apps report is `mcse(trace)`). Checks: e in [0, 1]; S an
integer ≥ 1. Examples: e .18837955890579108 → S 1,000 .012364978798697985, S 100 .03910149622357828, S 4,000
.0061824893993489925.

### `maxCoefficientError(Ehat, E)` (1.17) → `{ epsilon, at }` (pairwise.ts)

epsilon[k] = the largest |ê_ijk − e_ijk| over ordered pairs i ≠ j (the `epsilon` of `selectionOnDraws`); at[k] =
`{ i, j }` of the first largest in row-major (i, j) order. Checks: two ErrorArrays with the same n (≥ 2) and K.
Example: two units, one criterion, ê (0 above 1) .25, (1 above 0) .75; e .5 and .5 → epsilon [.25], at [{ i: 0, j: 1 }].

### `chainCountLaw({ p01, p10, S, radius = null })` (1.18) → `{ pi1, probs, outside }` (simulate.ts)

The exact law of the count of ones C = Σ_b X_b in S draws of the stationary chain of `twoStateChain` (X_1 = 1 with
probability π₁ = p01/(p01 + p10)). Forward recursion over (count c, current state x): f_1(x, x) = π_x (π_0 = 1 − π₁);
f_{t+1}(c + y, y) gains f_t(c, x)·P(x → y), with P(0 → 1) = p01, P(0 → 0) = 1 − p01, P(1 → 0) = p10, P(1 → 1) =
1 − p10; `probs[c]` = f_S(c, 0) + f_S(c, 1) for c = 0..S. With `radius` r: `outside` = Σ probs[c] over the c with
|c/S − π₁| > r (strict), summed in c order: the exact chance that the sample mean misses π₁ by more than r; `null`
without `radius`. Checks: as `twoStateChain`; S an integer in 1..5000; `radius` null or finite ≥ 0.
Examples: p01 .2, p10 .3, S 2 → pi1 .4, probs (.48, .24, .28); p01 = p10 = .01, S 3 → probs (.49005, .00995, .00995,
.49005). Stay .99 (p01 = p10 = .01), S 100: radius .14802071873008 (`envelopeRadius(1, 100, .05, "book")`) → outside
.804345459102859; radius .135810151574062 (`"package"`) → .817706439802635; S 1,000, book radius .0468082612082199 →
.770173951294846. Stay .5 (p01 = p10 = .5): S 100, book → .00351764172297016; S 1,000 → .00325259981316338.

### `runningMean(trace)` (1.18) → `Float64Array` (simulate.ts)

m_b = (running sum of trace[0..b − 1], accumulated in order)/b for b = 1..S. Checks: a nonempty array of finite
numbers. Example: (1, 0, 0, 1) → (1, .5, 1/3, .5).

### Extensions of existing functions

- `disclosure(g)` also returns `withheld` = M − N. Example: the report 1/1/2/2/3/3 → M 15, N 12, withheld 3.
- `leastCertainPairs(E, { k, w, order })`: with `order` (a permutation of 0..n − 1, e.g. a display order) each pair
  also has `apart` = |pos(i) − pos(j)|, the positions in `order`; without `order` there is no `apart`. Example: the
  six sites, score A, k 3, order (0, 1, 2, 4, 3, 5) → (C, D) apart 2, (A, B) 1, (E, F) 2.
- `intervalOverlapTally`: each pair also has `amount` = min(upper_i, upper_j) − max(lower_i, lower_j) (the length of
  the overlap when positive, the gap when negative; CR-330) and `nested` = (lower_i ≤ lower_j and upper_j ≤ upper_i)
  or (lower_j ≤ lower_i and upper_i ≤ upper_j) (equal intervals are nested); the result also has `nestedCount`.
  Example: lower (0, 1, .5), upper (2, 3, 1.5) → (0, 1) amount 1, not nested; (0, 2) amount 1, nested; (1, 2)
  amount .5, not nested; nestedCount 1.
- `formatProb(x, { digits, bounds, open })`: `open` (default false) says that the value is known to lie strictly
  inside (0, 1), for example a normal pair probability whose double is exactly 1 (CR-008). Then exact 0 is written
  as a nonzero value that rounds to 0 ("below .001"; "<.001" with `bounds: "symbols"`) and exact 1 as a value below 1
  that rounds to 1 ("above .999"; ">.999"); with `bounds: false`, `open` changes nothing. Examples: (1, { open: true })
  → "above .999"; (0, { open: true, bounds: "symbols" }) → "<.001"; (1, { open: true, digits: 2 }) → "above .99";
  (.5, { open: true }) → ".500"; (1) → "1" (unchanged).
- `majorityWins` also returns `cycleTriples`: one entry per cyclic triple, the triples taken in lexicographic order
  of their sorted indices a < b < c, each written [a, x, y] with a its smallest index, a beating x, x beating y and
  y beating a. Example: three units where 0 beats 1, 1 beats 2 and 2 beats 0 → [[0, 1, 2]]; 0 beats 2, 2 beats 1, 1
  beats 0 → [[0, 2, 1]]; the six sites → [].

### Read-out pins (oracle rows of existing functions at the apps' settings)

So that read-out cases cite golden rows, the oracle also writes rows of existing functions at these settings
(the league: `league30()`, `drawLeague(seed)`, the teaching posterior with prior mean 0):

- 1.1: `disclosure` of KRW's race and gender cards (`data/released/case-krw.json`); `normalCoverage(1)`.
- 1.2: `simulateEstimates(.5, .2, 20, 2)`; `withinBand` of `simulateEstimates(.5, .2, n, 1)` for n 20, 21, 200 and of
  `simulateEstimates(−.3, .05, 7, 20261030)`.
- 1.4: `leagueOvershoot(20261029, …)` with 2,000 replays at (k 3, bottom, prior .15), (k 3, top, .05), (k 3, top, .10),
  (k 1, top, .15), (k 10, top, .15), and with 20 replays at (k 3, top, .15).
- 1.5: `meanSquaredDistance` of the posterior means (draw 20261030) to θ at prior SD .02 and .04.
- 1.6: `expectedSquaredDistance` at prior SD .05 and .45; `meanSquaredDistance` at .02 and .45; `pairCertainty` at .02,
  .05, .45 and the flat prior; `fartherCount` and `misorderedPairs` at .45; `expectedMisorderedPairs` at .14 and .45.
- 1.7: `normalPosterior` and the pair's error at the chain presets: estimates (.25, .05), SEs (.10, .20), prior SD .15
  and .05.
- 1.10: `finiteLawPairwise` on the independence and always-equal laws, `tieLawPairwise` on law 2, `rankSummaries` means
  on law 1, `mixturePairDirection` at upper-bump weights .05, .10, .30, .35, .95 (A: bumps at −.10 and 1.00, SD .10;
  B: N(0, .10²)).
- 1.13: `leastCertainPairs` on the league at prior SD .15 (k 10) with the order of the posterior means.
- 1.14: `transformedMeans` on the league at prior SD .15, exp, k 10.
- 1.15: `majorityWins` on the league at prior SD .15 and on KRW's gender array (with `cycleTriples`).
- 1.17: `gaussianDraws` + `drawErrors` for the six sites, seed 1, S 100, 1,000 and 4,000 (score A and both scores),
  `maxCoefficientError` of those against the exact arrays, `envelopeRadius(15, S, .05, "package")`.
- 1.18: `chainCountLaw` at stay .99 and .5, S 100 and 1,000, with the book and package radii.

### v3 helpers: Part 1 supplement, readings fixed at Step 3.27

The TypeScript implementation and the base-R oracle (`r-export/18_v3_part1.R`, 390 rows in
`verification/golden/oracle-v3p1.json`, of which 54 pin existing functions at the apps' settings) were written apart
from the section above and agree on every row (933 comparisons, 0 failures, 0 exemptions). Where the text left a
choice, both follow these readings:

- `pairDifference`: "degenerate" means the variance as evaluated is not > 0, which includes a variance that rounds
  below 0 (ρ = 1, SDs one ulp apart): a RangeError, as `pairDirection` gives.
- `sharedMeanPosterior`: `meanSd` = 0 is refused; the known-mean limit (muVar 0, muMean = μ₀, corr 0) is the
  teaching posterior of `normalPosterior`, which an app calls instead. The last bit of var_i depends on the order of
  σ²·se²/v; the two implementations differ there by at most 2 ulp, inside the tolerance.
- `chainCountLaw`: the printed examples are the exact values (checked at 40 digits); the double recursion of the text
  loses about 1e−14 of mass by S = 1,000 (the engine gives .7701739512948401 at stay .99, S 1,000), and a compensated
  sum in c order (the oracle) agrees with a plain one within 1e−15. "Stay .99" is p01 = p10 = .01; the oracle also pins
  p = 1 − .99.
- `withinBand`: z is computed in double as in `evidenceFlags`, so est .8, ref .5, se .2 gives z = 1.5000000000000002.
- `finiteLawCells`: i > j is allowed and gives the transposed table; values are distinct under `===`, zero-probability
  states included.
- `maxCoefficientError`: equal arrays give epsilon 0 at { i: 0, j: 1 }; labels are not compared, only n and K.
- `leastCertainPairs`: an `order` that is not a permutation of 0..n − 1 throws; `order: null` is no order.
- `majorityWins`: `cycleTriples` uses the strict "beats" of `cycles`; [a, b, c] when a beats b, else [a, c, b].
- `formatProb`: `open` must be true or false (null and undefined mean false).
- `selectionOnDraws` now takes its epsilon from `maxCoefficientError` (bit-identical; the oracle-v3 rows still pass).
- The oracle parses every 17-digit input through jsonlite: on this aarch64 R build R's own number parser is not
  correctly rounded (0.19999999999999998 parses to 0.2), and `as.numeric(sprintf("%.15g", x))` moves about one value
  in five below 1e−20 by an ulp; older oracle rows may carry such one-ulp input differences inside their tolerances.


## Part 3 supplement (Phase 6, Step 6.1)

Contracts approved against the final thirteen-app catalog and independent audit notes in
the numerical specification and `part3-new-concept-math-audit.md`.
All operations reject unknown options and invalid inputs. Independent base-R fixtures are required before UI use.

- `tierSizeDistribution(n,G)` accepts integer n=2…30 and G=1…n. A pattern is an **ordered positive composition**
  (grade1 size,…,gradeG size); every pattern has equal weight, irrespective of the number of unit assignments.
  Returns `{n,G,M,totalPatterns,distribution:[{N,withheld,count,probability}],maxN,maxShare,balancedSizes}` sorted by
  ascending N. Counts use a dynamic program over used units/grades/withheld pairs; they are exact safe integers in
  this domain. `balancedSizes` puts the n mod G larger blocks first; permutations also maximize disclosure.
- `reportInformation(g,E)` returns the single-criterion KRW information `(N−2E)/M`, equivalently
  `−krwRisk(g,E,{lambda:1})`. This is the tie-free KRW information convention; it is not a new general guarantee.
- `thresholdViolations(E,{tau,w,details=false})` accepts tau in **[0,.5]** for the strict isolated-direction
  diagnostic (including the lambda0 endpoint). States i above j exactly when weighted e_ij<tau; if neither
  direction qualifies, withholds. Both directions qualifying is invalid and throws. No tolerance is added.
  Returns `{n,M,tau,relation,statedPairs,statedCount,aboveCounts,triples,invalidCount,counts,printable,unitIncidence,pairIncidence,
  violations}`. `counts` has `twoWithheld`, `statedChain`, `directedCycle`; these partition the fourteen invalid
  ternary weak-order patterns. Every i<j<k triple is inspected. `triples` is n choose3; `violations` is the entire
  invalid-triple list `{i,j,k,kind}` when details is true, otherwise null. Incidences count an invalid triple once
  per member and once per unordered constituent pair (symmetric matrix). Relations are +1 above,0 withheld,−1 below.
  `statedPairs` lists `{above,below,error}` in unordered i<j pair traversal order, with 0-based indices.
  `aboveCounts[i]` counts directions stating unit i above another unit; its sum equals `statedCount`.
  Printable means every triple is one of the thirteen relations induced by a three-unit report. This is a
  consistency check on isolated pair decisions, not a report optimizer or a directed-cycle-only test.
- `compareReportLosses(gBest,gRule,draws,{tau,w,tieTol=1e-12})` uses equal-weight whole-state draws (s×n×K, or s×n
  for one criterion) and holds both supplied reports fixed. Returns `{lossBest,lossRule,delta,meanBest,meanRule,
  meanDelta,mcseDelta,ruleWins,bestWins,ties,ruleWinShare,bestWinShare,tieShare,S,tieTol}`; delta=rule−best, a win
  is delta<−tieTol or delta>tieTol. Full realized loss includes the withholding cost and divides by M, never N.
  `mcseDelta` is sampleSD(delta)/sqrt(S), null for S=1. A finite mean can have either sign; the exact conditional
  risk comparison is a separate quantity. This function supplies no family-membership or optimality certificate.
- `relationChange` additionally returns `changed=nNewDisclosed+nNewWithheld+nReversed` and `changeShare=changed/M`.
  Its existing fields and tie/NA conventions are unchanged.
- `allocationValue(g,{values,pTop,budget})` accepts n finite utilities, n top-budget membership probabilities and
  integer budget0…n. Probabilities must be in[0,1] and sum to budget within 1e-10·max(1,n). They must describe an
  exact-cardinality target (latent tied ranks from rankSummaries do not generally do so). Include higher grades
  first and choose a uniform subset of the remaining size from the boundary grade, independently of the latent
  state. Returns `{inclusion,expectedValue,expectedOverlap,overlapShare,selectedCount,budget,boundaryGrade,
  boundaryMembers,boundarySize,remaining,aboveCount}`. `overlapShare` is null at budget0; totals are0 and all
  inclusion probabilities0 there, with no boundary (grade null,members[],size0,remaining0,aboveCount0). Otherwise
  the boundary is the first grade whose cumulative size reaches budget, including an exactly filled whole block.
  This is a lottery over complete budget-sized subsets, not independent unitwise Bernoulli selections.
- `thresholdClassification(probabilities,{falsePositiveCost,falseNegativeCost,positive?,values?})` accepts a nonempty
  probability vector and finite nonnegative costs with positive finite sum. The Bayes rule is **positive at
  equality** with cutoff FP/(FP+FN); the substantive event threshold is supplied by the caller's law separately.
  Optional `positive` is an explicit boolean or0/1 action vector of the same length. Optional `values` supplies
  matching finite posterior mean target values. `selectedValue` sums these values over the actual positive
  action flags (null when values are omitted), independent of any allocation budget. Returns `{positive,
  bayesPositive,positiveCount,cutoff,positiveCost,negativeCost,expectedFalsePositives,expectedFalseNegatives,
  totalCost,meanCost,selectedValue}`. Preserve none/all positive as distinct actions. There is no exact-budget constraint;
  costs normalize by units for meanCost, never by report pairs/disclosure.

Existing compositions explicitly retained: each stability remeasurement uses `drawLeague`→`normalPosterior`→
rule→`evaluateReport`, with disjoint seed pairs shared across rules; analytic normal threshold probabilities use
`pairDirection(mu,sd,threshold,0)` and finite events use a deterministic reference in `finiteLawPairwise`.
Neither needs a new estimation function. Monte Carlo top-membership estimates remain labeled Monte Carlo.


## v3 helpers: Part 4 supplement (Step 7.1)

Implemented after independent source/mathematics audits. R35 supplies135 independent base-R rows;
all37 parity groups/17,966 comparison fields agree with no exemptions. The original32 complete
toy states are released with source provenance and exact double round-trip checks (R36).
The signatures and numerical boundaries below are the public contract; application-specific
compositions do not authorize a second numerical implementation in the UI.

## 1. pairDecision addition

Add directionalMinimum=min(eIJ,eJI) to PairDecision. It excludes withholding. Existing costs/best order/tie tolerance unchanged. At known state this is gamma; at posterior errors it is the smaller expected directional cost. It is not generally E[gamma] and conflictPairs remains a distinct unweighted preferred-direction flag.

### 2. commonalityCost addition

Add commonReports:[{grade,Rk,delta,relationAgreement}], one per retained common.grades entry in SAME order. Rk/evaluation is for that report; delta[k]=max(0,Rk[k]-criteria[k].ownRk); relationAgreement[k] compares its pair relations with criteria[k].ownGrade. Preserve common.tieCount/maxTies truncation and existing first-common criteria outputs exactly. Reuse each own optimum, not rerun for every common report. No change to archived cost_lower/cost_upper meanings.

### 3. weightBreakpoints addition

Nonempty result adds envelopeMaximum:{risk,intervals:[{from,to}],tieTol}. Derive maximum risk of the exact piecewise affine LOWER envelope over [0,1], from its affine segments/endpoints, no sampling. intervals list maximizing weights: isolated maximizers as from=to; flat maximizing intervals retained; adjacent matching flat pieces merge. Use the existing risk-scale tieTol for equal maximum values, disclose it; do not confuse risk with its weight coordinate. Preserve every existing interval including zero-length end intervals and all prior outputs. Empty result stays empty. Constant envelope -> [0,1]. This maximum may be strictly below deterministic criterion minimax. It is not the worst weight for a fixed report (a simplex vertex).

### 4. normalComposite (NEW)

normalComposite(means,sds,{a,multiplier?,ids?}) -> {mean,sd,E}.

means/sds are matching rectangular n×K numeric arrays, n>=2,K>=1; all means finite, SD finite>=0. a has K finite coefficients (general coefficients allowed); multiplier has K finite strictly-positive entries, default1. All inputs are an explicitly INDEPENDENT Normal joint law: independent units and independent criteria within unit. mean_i=sum a_k*multiplier_k*means_ik; sd_i=sqrt(sum (a_k*multiplier_k*sds_ik)^2). E is the single-criterion weak-error array named composite; matching ids default existing engine labels. For a deterministic pair with both SD0, weak error is indicator(mean_i<=mean_j), so equal composites have both directional errors1. Do not inject noise or infer independence from marginal E. Six-sites declares this independence; thirty-sites does not. UI keeps a on simplex for package-comparable mode, though API remains general like estimandCosts. Return no posterior object for known means pretending to be a joint law.

### 5. compareReports (NEW)

compareReports(g0,g1,E,{tau,w?}) -> {before,after,deltaRisk,errorTermDelta,withholdingTermDelta,change,pairs}.

before/after are unchanged evaluateReport outputs. deltaRisk=after.risk-before.risk; errorTermDelta=(after.Ew-before.Ew)/M; withholdingTermDelta=tau*(before.N-after.N)/M. change is relationChange(g0,g1,E,{w}), including the new relation's weighted error where applicable. pairs contains every changed unordered i<j, in that order: {i,j,beforeRelation,afterRelation,beforeCost,afterCost,costDifference,normalizedDifference}. Relation convention+1 means i above j,0 withheld,-1 reverse. Raw pair cost is tau if withheld, weighted e_ij or e_ji otherwise; costDifference=after-before, normalizedDifference=costDifference/M. Their sum is deltaRisk. No clipping: arbitrary comparisons can be negative. Nonnegative extra risk requires a same-law/family optimum as baseline and an eligible alternative; this function supplies no optimality/cause certificate.

### 6. pairConstrainedOptimum (NEW; optimize.ts worker)

pairConstrainedOptimum(E,{tau,w?,family?,stating?,tieTol?,maxTies?}). Defaults family all, stating[], tieTol1e-12, maxTies100. Family is existing Family (no q/budget intersection in this new signature). Each stating entry is [aboveIndex,belowIndex], valid distinct integer indices; duplicates normalize away, preserving the first occurrence order in returned stating metadata. Invalid index/self pair throws; contradictory directions are a valid empty constraint set, return empty.

For enumerable non-order families, retain exactly reports satisfying g[i]<g[j] for every constraint. Preserve existing enumeration budgets. Return ExactOptimum or EmptyOptimum with constrained family metadata. For family.kind=order, use constrained fixed-order DP, allowing n97 without enumerating: reject an orientation inconsistent with the given order or an indivisible score block; forbid a grade segment spanning both endpoints of ANY required pair. Preserve order/blocks/cap/exact semantics, package representative (fewer grades then earlier cuts), gradesOrder, full tieCount, maxTies and ordinary FixedOrderResult fields. Return an explicit EmptyResult with label optimal-within-order when infeasible. The count of feasible complete reports must be exact (BigInt internally, number/string convention as FamilyLabel); compute it separately from optimal tie count.

Successful and empty results add baseFamily (ordinary familyInfo), stating (normalized pairs); family.size is CONSTRAINED candidate count, family.baseSize=baseFamily.size. With nonempty stating, family.name='𝒜_S ('+baseFamily.name+')', family.words=baseFamily.words+' satisfying the stated pair directions'; containsAllWithheld=false. Without constraints preserve ordinary family name/words/size, labels/representative, and containsAllWithheld. Constrained success retains label exact-within-family or optimal-within-order; empty likewise. No constraint -> same scientific answer as the existing producer. Filtered exact families need FULL minimizing tieCount/list, not merely k=1 bestReports.

KRW4.12 uses a NEW declared expected-rank contiguous-cut producer at most4 grades, both baseline and counterfactual under the same released law/order/family. It is never the unrestricted97-unit optimum or a constrained price relative to an archived KRW card. Same-order uncapped comparison can test cap effects conditionally, not certify unrestricted coherence. Six-sites all/cap and CDE12cap3 use the enumerable route, with staged/cached UI work.

### 7. protectionEnvelopes (NEW)

protectionEnvelopes(Ehat,Eexact,{q,epsilon,family?,tau,w?,feasibilityTol?,coefficientTol?}) -> {family,tau,w,q,epsilon,innerThreshold,outerThreshold,feasibilityTol,coefficientCheck,actualBracketInclusions,counts,empty,rows}.

Matching ids/criteria/order/dimensions, valid weak-error arrays. q lengthK, each null (unprotected) or finite[0,1]; epsilon nonnegative finite scalar broadcast or lengthK vector. tau/w/family use ordinary validation; family must fit existing enumerable domain. feasibilityTol finite>=0 default0 (raw homogeneous count tests); coefficientTol finite>=0 default1e-12. Inner/outer thresholds are q-epsilon/q+epsilon, null for inactive q, NEVER clipped. Every active criterion stays protected at zero error weight.

Each row: {grade,N,estimated,exact,membership,slack}. estimated/exact are evaluateReport on Ehat/Eexact with same tau/w. membership has {inner,nominal,exact,outer}: inner Ehat<=(q-eps)N, nominal Ehat<=qN, exact Eexact<=qN, outer Ehat<=(q+eps)N, each allowing ONLY explicitly supplied count feasibilityTol. slack has same4keys of lengthK arrays ((threshold*N)-E, null inactive). At N0 all homogeneous rows pass and fractions remain null. counts/empty have same4keys, computed from full rows.

coefficientCheck:{maxAbs,excess,strictEnvelopeHolds,withinCoefficientTolerance,coefficientTol}; maxAbs is per-K maximum absolute directional coefficient error, excess=maxAbs-epsilon. Checks retain ALL K criteria including zero weights; strict uses raw<=0, advisory withinCoefficientTolerance uses <=coefficientTol. Keep the actual maxAbs (e.g. .10000000000000009), no rounding. Soft flag is NOT a certificate or a substitute for checking sets.

actualBracketInclusions:{innerSubsetExact,exactSubsetOuter,innerSubsetNominal,nominalSubsetOuter,counterexampleInnerExact,counterexampleExactOuter}. Compute from full membership sets independently of the coefficient flag. Counterexamples are lexicographically first grade or null. Under default raw memberships this shows what actually holds in the supplied floating inputs. Do not infer a true inclusion from a soft coefficient comparison. No solver/numerical-certification flag and no probability computed by this helper.

App4.14 defaults to book's deterministic Ehat_AB=t, Eexact_AB=t+.1, reverse complements, q=t+.05, tau.25, t0/.2 and epsilon.1 presets. Epsilon control is a PROPOSED envelope radius with exact/estimated laws kept fixed, so reducing it may make event/brackets fail. Say so. Canonical decimal strict check can fail by roundoff while advisory check and actual inclusions hold; label numerical comparisons transparently, not theorem failure/model failure. Distinguish exact family empty from inner family empty (not certified).

A separately labelled fixed-S IID illustration may use six-site exact Normal law, seeded whole-state draws, drawErrors and the existing book/package envelopeRadius with stated alpha allocation and actual1.17 producer reuse. 1-alpha concerns repeated fixed-size numerical samples conditional on law, not posterior probability of protection or model calibration. No MCMC ESS substitution/adaptive stopping. Do not add a constrained-regret certificate to a membership-only app.

### 8. drawErrors additive raw counts

Return additive S:number and counts:number[K][n][n] in DrawErrorArray extending ErrorArray. Off-diagonal counts are original exact integer weak-error counts before dividing by S; diagonals remain undefined/NaN like e. Existing ids/criteria/e are unchanged. This supplies the actual k/S numerator for the original32/prefix/shuffle view, avoiding app-local reconstruction by multiplying rounded probabilities. Pin original32, prefixes, latent ties and invalid empty input independently.

### 9. Approved PUBLIC compositions, no new duplicate numerical implementation

Finite composite law: for each whole finite state call estimandCosts(state,{a,w,tau,multiplier}).c, reshape engine c outputs to a one-criterion state, then finiteLawPairwise(compositeStates,probs). Original finiteLawPairwise(states,probs) supplies criterionE. exactOptimum/evaluateReport compare BOTH fixed reports under BOTH losses in one family. wrongCountDistribution(g,states,probs,{w}) supplies complete joint count distribution/pAllCriteriaRight/pNone; do not infer these from E.

Toy32: export actual tensor from ../postrank-R-package-public/inst/examples/synthetic-iid.json (publicman documents samepostrank_toy); preserve draw/entity/criterion axes, ids/criterion names, source checksum/notice. Existing toy.json is coefficient/summary only. A deterministic cyclic unit-wise row permutation is approved input reindexing: newdraw[s][chosenUnit] = original[(s+shift)%S][chosenUnit] (the WHOLE K-vector); all other units unchanged. This changes joint law, not a valid resampling claim. Shared all-unit permutation boundary leaves E unchanged. drawErrors(eachprefix) yields running weak-error shares; drawErrors([state]) gives indicators; no app numerical counting shortcut.

Settings lattice: explicit Cartesian settings, stable row IDs, exactOptimum/evaluateReport/relationChange; not package default one-at-a-time. Preserve sparse archived30 source path/status/gap without interpolation as exact breakpoints. Cap changes FAMILY, not LOSS; fixed law,tau,w risks across caps are comparable. Increasing nested cap cannot raise exact optimum risk. Changes of tau/w change loss.

Restated exact laws: chapter19 states/probs and coupling editor from concept-audit note, tagged source/provenance; no new released data needed for tiny pedagogical law constants. Every new output and the finite-composite/shuffle/settings compositions need independent R35 pins. New exports4: normalComposite, compareReports, pairConstrainedOptimum, protectionEnvelopes. Existing function additions4: pairDecision, commonalityCost, weightBreakpoints, drawErrors. No new exemptions.

### Approved fixed-report correct-fraction composition (4.13)

For a fixed report `g`, form `matrix = weightedError(E,w)` and evaluate the single weighted criterion with
`evaluateReport(g,{ids:E.ids,criteria:['weighted'],e:[matrix]},{tau,w:[1]})`. When `N>0`, the expected weighted
fraction of correct stated directions is the scalar complement `1 - evaluation.EoverN[0]`; at `N=0` it is null.
This explicit complement is an approved public-call composition, independently pinned by R41. It is different
from `wrongCountDistribution(...).pAllCriteriaRight` and `.pNone`; zero-weight criteria remain included in the
former joint event. `realizedWrong(g,state,{w}).D` supplies each state’s criterion-specific wrong counts. Apps
must not reconstruct those counts locally. No new engine function or sampling certificate is implied.

### Approved criterion-mixture contributions (4.8)

For `m = criterionMixtureRisk(g,E,{w,tau})`, each displayed contribution is the explicit scalar product
`m.w[k] * m.Rk[k]`. Use `m.risk` for the sum and `m.weightedRisk` for the direct reporting-risk comparison;
do not introduce a separate UI summation routine. The auxiliary criterion is selected once for the whole unit
vector. Inspecting one branch does not resample a criterion per unit or pair and does not refit the report.


## v3 helpers: Part 5 supplement (Step8.1)

The binding numerical/data contract is the numerical specification. It adds `krwBridgeParameters(axis)` and `krwCorrespondence(E, options)` for positive lambda/tau, explicit tie-free single-criterion scope, complete same-family KRW/postrank minimizing sets before returned-list truncation, and actual all-report affine residuals. Implementations and independent R44 fixtures are written apart. Existing goldens/tolerances are closed. The supplement also defines approved49-grid and same-frozen-order97firm cost compositions; it does not make a new global-optimality claim.
