# pr-core engine

`pr-core` is the numerical engine of postrank Explorer. Every number an app computes comes from these TypeScript
sources (this README is carried over from postrank Explorer v1; its mentions of the number registry, widgets and
CONTRACT sections describe v1, whose engine v2 reuses unchanged). They are pure functions with no DOM access.
`API.md` lists the planned signatures of every module. This README covers the modules that exist now, their
definitions and accuracy, the random stream, the display rules, and how to build and test.

| Path | What it is |
|---|---|
| `src/special.ts` | standard normal cdf, upper tail, density and quantile; `erfc` |
| `src/random.ts` | the one seeded stream: mulberry32 integers, open uniforms, Box–Muller normals |
| `src/format.ts` | display precision for widgets and the registry builder |
| `src/pairwise.ts` | direction, weak-error, strict-error and equality probabilities (normal, mixture, finite law, draws) |
| `src/report.ts` | canonical grades, disclosure counts, relations and per-unit relation counts, family sizes, score order and blocks, report-card row order |
| `src/risk.ts` | evaluation of a fixed report, isolated pair, KRW correspondence, equality-neutral risk, disclosed-error estimands |
| `src/optimize.ts` | report enumeration, exact optimum within a family (with error budgets), fixed-order DP, τ and weight paths, weight breakpoints |
| `src/frontier.ts` | report cloud per N, lower hull H(m), supporting vertex, matched disclosure (ψ), order hull, half-slope check |
| `src/multi.ts` | several criteria: conflicts, weighted errors, cost of a common grade, the two estimands, budgets, criterion mixture, minimax, weight crossing |
| `src/rules.ts` | common rules as reports: strict order, quantile tiers, evidence flags, weighted expected rank |
| `src/simulate.ts` | seeded estimates, the SR-06 league and its replays, teaching posterior, misordering, rank summaries, KRW Example 1, Gaussian draws, MCSE, envelope radius, Monte Carlo fragility |
| `src/summaries.ts` | sample mean and SD, mean squared distance, units that end farther, interval-overlap tally, rank intervals |
| `src/mip.ts` | the browser MIP over the unrestricted family (highs-js); solver bundle only, not exported from `index.ts` |
| `src/options.ts` | internal: options checks, display counts (number or decimal string) with their exact BigInt |
| `src/index.ts` | public API (`PR_CORE_VERSION` and the exports below) |
| `tests/*.test.ts` | `node --test` suites; `tests/fixtures/*.json` hold the reference values |
| `scripts/` | build steps, bundle builder, freshness hash and check, fixture generators |
| `../js/pr-core.js` | ES module (pages, widget modules) |
| `../js/pr-core.umd.js` | UMD build, global `prCore` (classic `<script>`, works on `file://`) |
| `../js/pr-core.d.ts`, `../js/types/*.d.ts` | type declarations (the entry re-exports `types/index.js`; `types/mip.d.ts` describes the solver) |
| `../js/bundles/solver.js` | solver bundle for browsers: `window.PRX_SOLVER = { mipSolve, ready }`, highs-js in a blob-URL Worker |
| `../js/bundles/solver-node.mjs` | the same solver as an ES module for Node (`verification/run_parity.mjs`) |
| `../js/pr-core.hash.json` | SHA-256 of every build source and output (bundle freshness) |

## Build and test

Tested on Node 25.8.1 (npm 11.11.0), which runs the `.ts` tests directly by type stripping. The toolchain is
pinned to exact versions in `package.json` and `package-lock.json`: TypeScript 5.9.3, Vite 6.4.5 and esbuild
0.25.12 (devDependencies), and highs 1.15.4 (the one dependency: it is bundled into the solver bundle only).
`node_modules/` is not committed.

```sh
cd engine
npm ci                          # or: npm install (same pinned versions from the lock file)
npm run build                   # typecheck, clean, vite library build (ES + UMD), .d.ts, widget and solver bundles, hash
npm test                        # node --test "tests/**/*.test.ts"
npm run check:fresh             # exit 1 if a source changed after the last build or an output was edited
npm run check:fresh:self-test   # injects 15 faults into an in-memory copy; all must be caught
npm run solver                  # rebuild only js/bundles/solver.js and solver-node.mjs
npm run fixtures                # regenerate tests/fixtures (Rscript 4.6.0, python3 with mpmath)
```

`npm run build` runs `tsc --noEmit`, then `scripts/clean-outputs.mjs` (which removes only the pr-core and solver
outputs listed above), `vite build`, `tsc -p tsconfig.build.json`, `scripts/write-dts-entry.mjs`,
`scripts/build-bundles.mjs`, `scripts/build-solver.mjs` and `scripts/write-hash.mjs`.

`scripts/build-bundles.mjs` turns each app `js/apps/<name>.js` into a classic IIFE bundle
`js/bundles/<name>.js` that sets `window.PRX[name] = { mountWidget }`. esbuild inlines the engine, the shared
modules in `js/shared/`, `catalog.json` and the data the app imports (postrank Explorer v2; `scripts/build.mjs` at
the repository root runs it with `--check` or before writing the embeds and hosts). `scripts/build-solver.mjs` writes the two solver bundles (see mip.ts below); no widget bundle
contains WebAssembly.

Vite is used for library builds. This project does not start the Vite development server.

## Conventions for every module

- **Probabilities** are criterion-major `e[k][i][j]` (K × n × n, K = 1 allowed), with a NaN diagonal. A row may be
  any array-like of numbers, typed arrays included (`Float64Array` rows are accepted wherever an `ErrorArray`
  is).
- **Options** are one object after the data (`{ tau, family, w, … }`). Anything else in its place throws
  "options object expected: {tau, w}" (for example `evaluateReport(g, E, 0.2)`), and a key the function does not
  know throws an error naming it, so a misspelt or renamed option is never ignored (`scale` → `multiplier`, `tol`
  → `tieTol` say so). Family objects are checked the same way (`{ kind: "atMost", G, exact }` throws on `exact`).
  The functions that take τ positionally (`pairDecision`, `supportingVertex`, `krwExample1Band`) keep doing so.
- **Tolerance.** One convention: two reports tie when their risks differ by at most `tieTol` (default 1e-12) on
  the **risk scale**, that is when Ew − τN differ by at most tieTol·M in count units. This holds for
  `exactOptimum`, `fixedOrderDP` (on V), the τ and weight paths, `reportCloud`, the hulls, `supportingVertex`
  (which converts with M), `minimaxChoice` (whose values are risks) and `conflictPairs`; `statedAbove` counts a
  stated pair when ē > τ + tieTol and `pairDecision` lists every action within 1e-12. `tieTol: 0` compares
  exactly. Not tie tests, and exact on purpose: the budget residual E_k − q_k N ≤ 1e-12 (a feasibility
  tolerance in count units), and the package's own equality rules (score blocks, quantile ties, the fragility
  screen's "i ahead on ties").
- **Tied optima** are listed in `grades` (lexicographic order of the grade vector), at most `maxTies` of them
  (default 100; `Infinity` lists all), and `tieCount` counts them all; show a "tied optima" badge whenever
  `tieCount > 1`. `grade` is the lexicographically first optimum, except for an order family, where it is the
  package's choice (fewer grades, then the earlier cut), so `exactOptimum` over 𝒜ᵨ and `fixedOrderDP` return
  the same report.
- **Counts** shown with a result (`family.size`, `family.baseSize`, `fixedOrderDP().tieCount`) are a number up to
  2^53 and a decimal string above, so every result passes `JSON.stringify`. The exact count rides along as a
  non-enumerable BigInt (`family.sizeExact`, `tieCountExact`): `JSON.stringify`, `structuredClone` (so the solver
  Worker) and deep-equality checks skip it. `familySize()` itself still returns a number or a BigInt.
- **Empty families.** Every function that would return an optimum, a path, a cloud or a hull returns
  `{ empty: true, family, containsAllWithheld: false, label }` for an empty family (`exactOptimum`,
  `budgetFamily`, `tauPath`, `weightPath`, `weightBreakpoints`, `reportCloud`, `orderHull`, `fixedOrderDP`,
  `minimaxChoice`, `commonalityCost`), never an exception (`budgetFamily` keeps its own fields, with `size: 0`
  and `optimum: null`); their nonempty results carry `empty: false` (an `orderHull` result is then the vertex
  array, which has no `empty` field). `enumerateReports` yields nothing.

## special.ts: normal distribution and erfc

| Function | Contract |
|---|---|
| `normalCdf(z)` | Φ(z) = Pr(Z ≤ z). Accurate relative to Φ(z) in the lower tail. Returns 0 for z ≤ −37.5193 and 1 for z ≥ 8.2924, as R's `pnorm` does. NaN → NaN. |
| `normalSf(z)` | 1 − Φ(z) = Pr(Z > z), computed directly, never as `1 − normalCdf(z)`. Accurate relative to itself up to z = 37.5193 (0 beyond, as R). `normalSf(z) === normalCdf(−z)`. |
| `normalPdf(z)` | φ(z) = exp(−z²/2)/√(2π). For \|z\| ≥ 5, z is split so that z² is formed exactly (as R's `dnorm`). Returns 0 beyond \|z\| = 38.5677. |
| `normalQuantile(p, { lowerTail = true })` | Φ⁻¹(p). With `lowerTail: false`, p is the upper-tail probability, so tiny upper tails keep full precision. ±Infinity at p = 0 or 1, NaN outside [0, 1]. |
| `erfc(x)` | (2/√π) ∫ₓ^∞ e^(−t²) dt, computed directly. Returns 0 for x ≥ 26.543 (below the smallest normal double), and 2 − erfc(−x) for x < 0. |

**Definition sources.**

- `normalCdf` and `normalSf` use Cody (1993), ACM TOMS 19, 22–32, routine ANORM. This is the algorithm of R's
  `pnorm` (`nmath/pnorm.c`), including its cut-offs. It uses rational approximations on |z| ≤ 0.67449,
  (0.67449, √32] and (√32, 37.5193). The factor exp(−z²/2) is computed as exp(−z_r²/2)·exp(−d/2), with
  z_r = trunc(16z)/16 and d = (z − z_r)(z + z_r). This split is what keeps full relative precision in the far
  tail.
- `normalPdf` follows R's `dnorm`, using Welinder's split z = z₁ + z₂, where z₁ is a multiple of 2⁻¹⁶
  (R PR#15620).
- `normalQuantile` uses Wichura (1988), Applied Statistics 37, 477–484, AS 241 PPND16. This is the algorithm
  of R's `qnorm` for min(p, 1 − p) ≥ 1e−300.
- `erfc` uses Cody (1969), Mathematics of Computation 23, 631–637 (SPECFUN routine CALERF), with the same
  exponential split.

**Accuracy** (the suites in `tests/special.test.ts`). The target is a relative error of at most 1e−14 for
|z| ≤ 37 and p ≥ 1e−300. The relative error is measured on the smaller tail (`normalSf` for z > 0,
`normalCdf` for z < 0).

| Function | Reference | Points | Max relative error |
|---|---|---|---|
| `normalCdf` | R 4.6.0 `pnorm` | 4,025 z on [−37, 37] | 4.3e−16 |
| `normalSf` | R `pnorm(lower.tail = FALSE)` | 4,025 | 4.3e−16 |
| `normalPdf` | R `dnorm` | 4,025 | 2.7e−16 |
| `normalQuantile` | R `qnorm` | 5,274 p on [1e−300, 1) | 7.0e−16 |
| `normalQuantile(·, {lowerTail: false})` | R `qnorm(lower.tail = FALSE)` | 1,901 p on [1e−300, 1) | 6.8e−16 |
| `erfc` | mpmath 1.3.0 at 50 digits | 2,471 x on [−6, 26.5] | 5.2e−16 |

Most values agree with R bit for bit. The rest differ by a few units in the last place, because V8's `Math.exp`
and `Math.log` differ from the C library R uses.

On a subset checked against 50-digit values, AS 241 alone reaches 6.3e−16. One Halley step in the tails would
lower this to 4.1e−16. That gain is not worth leaving R's algorithm, so no refinement step is applied.

## random.ts: the seeded stream

| Function | Contract |
|---|---|
| `rngUint32(seed)` | `() => number`: mulberry32 outputs, integers 0 … 2³² − 1 |
| `rng(seed)` | `() => number`: uniforms on the open interval (0, 1) |
| `normalStream(seed)` | `() => number`: standard normals (Box–Muller on `rng(seed)`) |
| `uniforms(seed, count)`, `normals(seed, count)` | the first `count` values as a `Float64Array` |

Each call to `rng(seed)` or `normalStream(seed)` starts a new, independent stream at the same state, so equal
seeds give equal sequences. A non-integer seed (including NaN and ±Infinity) throws `RangeError`.

### Random stream: the algorithm, step by step

All integer quantities are unsigned 32-bit values in 0 … 2³² − 1. Every operation is taken mod 2³²:

- `a ⊕ b` is bitwise XOR.
- `a ∨ b` is bitwise OR.
- `a ≫ k` is the logical (unsigned) right shift.
- `a ⊞ b = (a + b) mod 2³²`.
- `imul(a, b) = (a · b) mod 2³²`, the low 32 bits of the exact product.

1. **Seed.** The initial state is `s = seed mod 2³²`, for an integer seed. A negative seed wraps:
   −1 → 4294967295, and 2³² → 0.
2. **Integers (mulberry32).** Each call updates the state and returns one output x:
   ```
   s ← s ⊞ 0x6D2B79F5                      (0x6D2B79F5 = 1831565813)
   t ← s
   t ← imul(t ⊕ (t ≫ 15), t ∨ 1)
   t ← t ⊕ (t ⊞ imul(t ⊕ (t ≫ 7), t ∨ 61))
   x ← t ⊕ (t ≫ 14)
   ```
   Seed 0 starts 1144304738, 1416247, 958946056, ….
3. **Uniforms.** `u = (x + 0.5) / 2³²` in binary64, which is exact. So u ∈ [2⁻³³, 1 − 2⁻³³]: never 0 and
   never 1.
4. **Normals (Box–Muller).** The calls to `normalStream` alternate between drawing and returning a cached value:
   - On calls 1, 3, 5, …, take the next two uniforms of the stream, u₁ then u₂, and compute
     `R = sqrt(−2 · log(u₁))` and `θ = (2π) · u₂`. Here 2π is the double `2 * Math.PI` (in R, `2 * pi`), and
     it is formed first. Return `R · cos(θ)` and store `R · sin(θ)`.
   - On calls 2, 4, 6, …, return the stored value and draw nothing.

   `normals(seed, n)` therefore holds the cos/sin pairs of the uniform pairs (u₁, u₂), (u₃, u₄), …, and an odd
   n ends on a cos variate.

**Reproducing it in R.** R integers are signed 32-bit and have no unsigned shift, so hold every state as a
double in [0, 2³²). Do XOR and OR on the two 16-bit halves (`bitwXor(a %/% 65536, b %/% 65536) * 65536 +
bitwXor(a %% 65536, b %% 65536)`), and compute shifts as `a %/% 2^k`. For `imul`, split a = a_h·2¹⁶ + a_l and
take `(a_l·b_l + ((a_h·b_l + a_l·b_h) mod 2¹⁶)·2¹⁶) mod 2³²`. Every intermediate value stays below 2⁵³, so
the arithmetic is exact. `scripts/fixtures/stream-r.R` does exactly this.

Its output, `tests/fixtures/stream-r.json`, has 8 seeds, including 0, 2³¹, 2³² − 1 and −1, and a run of 1,000
values. The R reimplementation agrees with this engine:

- the integers and uniforms bit for bit;
- the normals to within 2 ulp (85 of 1,112 values differ in the last place). The cause is that `log`, `cos`
  and `sin` come from different maths libraries.

A parity check on normals should therefore use a tolerance of a few ulps. A relative error of 1e−15 is ample.

## format.ts: display rules

One module turns engine numbers into the strings learners read. Widgets call it, and so does the registry
builder (which writes `data/numbers.json` display strings). The house rules:

- **Rounding.** The exact binary value of the double is rounded to the stated number of places, with ties to
  even. This is what C `printf` and R's `sprintf("%.3f", x)` do, so display strings written by R and by the
  engine agree. `tests/fixtures/format-r.json` checks this: 9,520 R strings, 591 of them exact ties, all
  identical. A decimal literal that looks like a tie is usually not one in binary:

  | Value | Displayed | Why |
  |---|---|---|
  | .1875 | .188 | exact tie; rounds to the even neighbor |
  | .0625 | .062 | exact tie; rounds to the even neighbor |
  | 2.675 | 2.67 | stored as 2.67499… |
  | 1.0005 | 1.000 | stored as 1.000499… |
  | .0005 | .001 | stored as .000500…01 |

- **Leading zero.** It is dropped when the displayed absolute value is below 1 (.188, −.0227). It is kept in
  percentages (0.02%) and with `leadingZero: true`.
- **Minus sign.** Negatives use U+2212 (−), never the ASCII hyphen. A value displayed as zero never carries a
  sign.
- **Exact ends.** An exact 0 is written `0`, and an exact probability 1 is written `1`.
- **Bounds.** A probability, share, risk or percentage that is not exactly 0 (or 1) is never displayed as 0
  (or 1). It reads "below .001" (or "above .999") at the stated precision. Options: `bounds: "symbols"` gives
  "<.001", and `bounds: false` gives plain rounding. `formatProb(x, { open: true })` says the value is known to
  lie strictly inside (0, 1) (CR-008), so an exact 0 or 1 (a normal pair probability whose double is 1) also
  reads "below .001" (or "above .999"); with `bounds: false`, `open` changes nothing.
- **Grouping.** A comma separates thousands in the integer part (4,683; 28,091,567,595). There is no grouping in
  decimals, and none in `formatSetting` integers (seeds, caps).
- **NA.** `null`, `undefined`, NaN and ±Infinity are written `NA`. E/N with N = 0 is `NA: no disclosure`
  (`NO_DISCLOSURE`). `formatProb(null)` stays `NA`, so an engine E/N value (null when N = 0) must be shown with
  `formatEoverN`, never with `formatProb`.

| Function | Default | Examples |
|---|---|---|
| `formatProb(x, { digits = 3, bounds = true, open = false })` | probabilities and shares (π, e, N/M, E/N) | .188, .812, 0, 1, below .001, above .999; digits 4: .9999; open: 1 → above .999 |
| `formatRisk(x, { digits = 4, bounds = true })` | risks (expected loss per pair) and small expected counts | .0417, .0248, 1.8288, −.0227, below .0001 |
| `formatDecimal(x, { digits = 2, leadingZero = false, group = true })` | other quantities, fixed decimals | 13.65; digits 1: 1,249.5 |
| `formatSig(x, { sig = 3 })` | significant digits | .00165, .000203, 1,320 |
| `formatSci(x, { sig = 3, trim = false, style = "e" })` | very small or large values | 1.39e−17, 1e−12 (trim), 5 × 10⁵ (`style: "times"`) |
| `formatPercent(x, { digits = 0, bounds = true })` | a share as a percentage, rounded on the exact share | 14%, 5.2%, 0.02%, below 1% |
| `formatCount(n)` | exact counts; a safe integer or a BigInt (non-integers throw) | 4,683; 28,091,567,595 |
| `formatFraction(num, den)` | exact rational, lowest terms | 11/60, −1/2, 2; den 0 → NA |
| `rationalApprox(x, { maxDenominator = 1000, tolerance = 1e−12 })` | the fraction within tolerance (continued fractions), or null | 11/60 from 0.18333… |
| `formatRational(x, options)` | x as its fraction; throws if there is none | 11/60, 7/40, 3/10 |
| `formatRatio(num, den, { digits, sig, bounds })` | num/den with `formatProb` (or `sig`) rules; NA when den = 0 | .800 |
| `formatEoverN(E, N, options)`, `formatEoverN(EoverN, options)`, `formatEoverN(EoverN[], options)` | E/N from the counts, from one engine value (null = N = 0) or from an array such as `evaluateReport().EoverN` (gives an array of strings); `NA: no disclosure` when N = 0 | .0255 (digits 4) |
| `formatSigned(x, { digits = 3, sig })` | differences with an explicit sign | +.049, −.0227; displayed zero: .000 |
| `formatSetting(value)` | τ, λ, cutoffs, levels (see below); weight vectors | .20, .25, .125, 1/3, 1.96, 3; (1/2, 1/2), (1/2, 1/4, 1/4), (.8, .2) |
| `formatGrades(g)` | grade vector in unit order | 1/1/2/2/3/3 |
| `formatSizes(sizes, { label = true })` | grade sizes, grade 1 first | sizes 3, 6, 3 |
| `formatTuple(values, format = formatProb)` | a tuple with one formatter | (.15, .85, .20) |

The second argument of every formatter is its options object, so a formatter cannot be handed to `Array#map`
directly (`map` passes the index there, which throws "options object expected"): write
`xs.map((x) => formatProb(x))`, or use `formatTuple` and the array form of `formatEoverN`.

`formatSetting` writes a scalar as the shortest decimal with at least two places that equals it within 1e−12:
.20, .25, .125, 1.96. Failing that, it uses a fraction with denominator at most 12 (1/3), and otherwise 4
decimals. Integers are written plainly. A weight vector is written in fractions when every weight is k/q with
q in {1, 2, 3, 4, 6, 8, 12}. Otherwise it uses the shortest decimals.

## pairwise.ts: pair probabilities

All arrays are criterion-major, `e[k][i][j]`, with a NaN diagonal (JSON null in golden files). Units are 0-based;
default ids are A, B, … for n ≤ 26 and U01, U02, … beyond (so text order is index order); default criteria are
k1, k2, ….

| Function | Contract |
|---|---|
| `pairDirection(meanA, sdA, meanB, sdB, { corr = 0 })` | π = Φ((meanA − meanB)/√(sdA² + sdB² − 2·corr·sdA·sdB)). Throws when that SD is 0 (a point-mass difference). |
| `directionMatrix(means, sds)` | π_ij for independent normals; `sds` is a vector or one common SD. |
| `errorArray(means, sds, { ids, criteria, orient })` | ErrorArray for independent normals; `means`, `sds` are n × K (or n-vectors when K = 1, or one SD). e_ij = Φ(orient_k·(m_j − m_i)/√(s_i² + s_j²)), computed directly, so small errors keep full relative precision. `orient[k] = −1` flips the target's sign. |
| `finiteLawPairwise(states, probs, { ids, criteria })` | `{ ids, criteria, e, pi, t }` from `states[s][i][k]` and `probs[s]` (finite, ≥ 0, sum 1 within 1e-12, not normalized; `null` for equal weights). The result is itself an ErrorArray (field `e`). |
| `mixturePairDirection(components)` | Σ_c w_c π_c over `[{ w, meanA, sdA, meanB, sdB, corr }]`; weights ≥ 0 summing to 1. |
| `drawErrors(draws, { ids, criteria })` | ErrorArray from equal-weight draws `draws[s][i][k]`: count(θ_i ≤ θ_j)/S. |
| `tieLawPairwise(states, probs, { ids, criteria })` | `{ ids, criteria, b, t, d }`: Pr(θ_i < θ_j), Pr(θ_i = θ_j), Pr(θ_i ≠ θ_j); b_ij + b_ji = d_ij. |

**Ties.** The weak-error event (theory book ch. 11; App. B) counts latent equality as an error in both directions:
e_ij + e_ji = 1 + Pr(θ_i = θ_j). Finite laws and draws are aggregated directly from the states, never as 1 − π,
so the reverse complement e_ji = 1 − e_ij holds only when equality has probability zero (the m4 law: e_AB = .5,
e_BA = .9). Each probability of a finite law is a compensated (Neumaier) sum of the state masses, so it does not
depend on the order of the states beyond one rounding; draws use exact counts.

## report.ts: reports and families

| Function | Contract |
|---|---|
| `canonicalGrade(g)` | integer labels renumbered 1..G by rank, smallest label = grade 1 (`canonical_postrank_grade()`); pair relations unchanged |
| `pairCount(n)` | M = n(n − 1)/2 |
| `disclosure(g)` | `{ M, N, s, G, sizes }`: N = M − Σ_h C(n_h, 2) pairs in different grades, s = N/M, sizes grade 1 first |
| `relations(g)` | +1 row stated above column, −1 below, 0 withheld or diagonal |
| `unitRelationCounts(g)` | `{ n, partners, above, below, stated, withheld }`: per unit, #{j : g_i < g_j}, #{j : g_i > g_j}, their sum, and #{j ≠ i : g_j = g_i}; partners = n − 1 (the row counts of `relations`) |
| `weakRelation(g)` | `{ z, complete, transitive }`: z_ij = 1{g_i ≤ g_j} (NaN diagonal), z_ij + z_ji ≥ 1 and z_ij + z_jk − z_ik ≤ 1 |
| `familySize(n, family)` | exact count, a number up to 2^53 − 1 and a BigInt above; a key that does not belong to the family's kind throws |
| `scoreOrder(scores, { direction = "descending", ids })` | `{ order, blocks }` exactly as `postrank_cuts()` builds them: units by score, equal scores in entity-id code-point order (default ids A, B, … = index order), every run of exactly equal scores one block |
| `reportCardRows(g, summaries, sort)` | unit indices in display order |
| `statedAgainst(g, scores, { direction = "descending" })` | `{ count, pairs: [{ above, below }], units }`: stated pairs (g_i ≠ g_j) whose scores order the two strictly the other way, in pair order; `units` = ascending indices appearing as `below` (Step 7.1) |
| `relationChange(g0, g1, E = null, { w })` | `{ M, nSame, nNewDisclosed, nNewWithheld, nReversed, agreement, pairs: [{ i, j, from, to, error }] }` (as `postrank_compare()$relations`); `error` = ebar stated under g1, null when withheld or without E (Step 7.1) |
| `cutGrade(n, cuts, { order, blocks })` | Int8Array: grade 1 + #{cuts < p} for the unit at position p of `order` (default identity); a cut c with from ≤ c < to of a block `[from, to]` throws naming it (Step 7.1) |

Family sizes (theory book ch. 9): `all` is the ordered Bell (Fubini) number Σ_k k!·S(n, k) (3, 13, 75, …, 4,683 at
n = 6, 545,835 at n = 8; a(16) = 5,315,654,681,981,355 is the last one below 2^53); `atMost G` sums k!·S(n, k) for
k ≤ G (603 at n = 6, G = 3; 523,251 at n = 12, G = 3); `exactly G` is G!·S(n, G); `order` counts contiguous cuts
of the declared order, C(m − 1, G − 1) with exactly G grades and 2^(m−1) in all, with m = n, or m = the number of
`blocks` (sizes of indivisible runs of equal order scores along the order). `G` caps and `exact` fixes the count;
an empty family returns 0. All counts use BigInt arithmetic.

**Score order** (`R/baselines.R`, `.pr_cuts_core`): `fixedOrderDP` and `orderHull` take `scores` (with
`direction` and `ids`, default the ErrorArray's ids) in place of `order` and `blocks`, so a widget never rebuilds
the package's order itself. Leaving out the blocks of tied declared scores lets the DP split them, and its report
then differs from `postrank_cuts()`. [3, 3, 2, 2, 1, 1] gives order 0…5 and blocks [2, 2, 2].

Report-card order follows `postrank_report_card()` and `postrank_plot_report_card()`: grades stay contiguous,
grade 1 first; within a grade `grade` keeps the input order, `expected_rank` puts the smaller
`summaries.expectedRank` first (pass the weighted expected rank), `mean` the larger `summaries.mean` first, and
`label` sorts by id; remaining ties go to the unit id in code-point order (R's radix sort).

## risk.ts: loss and risk of a fixed report

Options are `{ tau, w }`: τ must lie in (0, 1/2] (anything else throws), and `w` (length K, ≥ 0, sum 1 within
1e-12, not normalized) defaults to [1] when K = 1. ē_ij = Σ_k w_k e_ij,k. Probabilities are criterion-major
e[k][i][j] (K × n × n); rows may be typed arrays.

| Function | Contract |
|---|---|
| `pairDecision(eIJ, eJI, tau)` | `{ costs: { iAboveJ, jAboveI, withhold }, best }`, best = every action within 1e-12 of the minimum |
| `evaluateReport(g, E, { tau, w })` | `{ M, N, s, G, E, EoverN, EoverM, Rk, Ew, risk, errorTerm, withholdingTerm }` (below) |
| `relaxedPairRisk(E, { tau, w })` | M⁻¹ Σ_{i<j} min(ē_ij, ē_ji, τ): independent pair choices, not a report |
| `betweenGradeErrors(g, E, { w })` | per grade pair h < h′: `{ h, hp, pairs = n_h n_h′, meanError, maxError }` of ē over stated pairs |
| `statedAbove(g, E, { tau, w, tieTol = 1e-12 })` | `{ pairs: [{ i, j, error }], count, max }`: stated pairs with ē > τ + tieTol, and the largest stated ē (null at N = 0) |
| `realizedWrong(g, theta, { w })` | `{ N, D, DoverN, A, AoverN, pairs }` at one state `theta[i][k]`: D_k counts stated directions with θ_ik ≤ θ_jk; A = Σ_k w_k D_k (null when K > 1 and no `w`) |
| `lambdaToTau(λ)`, `tauToLambda(τ)` | τ = λ/(1 + λ) for λ ∈ (0, 1]; λ = τ/(1 − τ) for τ ∈ (0, 1/2] |
| `krwRisk(g, E, { lambda, t })` | (1 − λ)·DR − λ·τ̄ with DR = E/M and τ̄ = (N − 2E)/M, K = 1, λ ∈ [0, 1]; a number. With the law's equality probabilities `t` (`finiteLawPairwise().t`) any t > 1e-15 throws "the KRW correspondence needs a tie-free law" |
| `equalityNeutralRisk(g, tie, { tau, w })` | `{ risk, R0 }` for `tie = { b, d }` (from `tieLawPairwise`) |
| `disclosedErrorEstimands(cases, { M })` | `{ ERR, meanFraction, zeroImputed, positiveFrequency, meanDisclosure }` over equally likely `[{ A, N, M? }]` |

**Evaluation** (theory book ch. 11, `postrank_evaluate()`): E_k = Σ_{g_i<g_j} e_ij,k, Ew = Σ_k w_k E_k,
risk = (Ew + τ(M − N))/M = τ + M⁻¹ Σ_{g_i<g_j}(ē_ij − τ), R_k = (E_k + τ(M − N))/M, errorTerm = Ew/M,
withholdingTerm = τ(M − N)/M. E_k/N is `null` when N = 0 (shown "NA: no disclosure", never 0); the all-withheld
report has risk τ. Sums are compensated. Six sites (means 1.20, .95, .25, .15, −.50, −.80; SD .20): e_AB = .188;
1/1/2/2/3/3 at τ = .20 has N = 12, E = .0248, E/N = .00206 and risk .0417.

**KRW** (ch. 10): under a tie-free law and λ = τ/(1 − τ), R_τ = τ + (1 − τ)·R_K,λ for every report, so the two
objectives have the same minimizers on a common family (tested on every report of the six sites and the
three-unit law). τ̄ = (N − 2E)/M uses e_ji = 1 − e_ij, so under ties it is not the book's KRW risk
Σx(π_ji − λπ_ij)/M (`prp-krw-pair-risk`; the m4 law at λ = 1/3 gives .333 against −.0667). Pass `t` and such a
law is refused instead of evaluated.

**Equality-neutral risk** (ch. 11 `prp-tie-aware-risk`; App. B; `postrank_tie_evaluate()`): risk =
Σ_k w_k (E^b_k + τ H_k)/M with E^b_k = Σ_{g_i<g_j} b_ij,k and H_k = Σ_{i<j, g_i = g_j} d_ij,k, which equals
(A_TA + τ(T_w − Q_w))/M; R0 = τ T_w/M with T_w = Σ_k w_k Σ_{i<j} d_ij,k. With no ties it equals the weak-error
risk and R0 = τ. The m4 law (B = 1; A = 0, 1, 2 with .1, .4, .5; τ = .25) gives .1 for A above B, .15 = R0 for
withholding and .5 for B above A, against weak-error risks .5, .25 and .9.

**Disclosed-error estimands** (ch. 16): ERR = ΣA/ΣN (null when nothing is disclosed), meanFraction = mean of A/N
over cases with N > 0 (null if none), zeroImputed = the same mean with undefined fractions set to 0 (a different
statistic), positiveFrequency = Pr(N > 0), meanDisclosure = E[N/M] (M per case or `options.M`; null when unknown).
The three-case example gives 2/5, 1/2, 1/3, 2/3 and 5/9.

## optimize.ts: exact optima, the fixed-order DP and the paths

Options follow risk.ts: τ ∈ (0, 1/2] (else throws), `w` (length K, ≥ 0, sum 1 within 1e-12) defaults to [1] when
K = 1, `family` defaults to `{ kind: "all" }`. Every optimum carries its result label (CONTRACT 6.2) and its
family `{ name, words, size }`, for example `{ name: "𝒜_≤3", words: "reports with at most 3 grades", size: 603 }`
(names: 𝒜₆, 𝒜_≤G, 𝒜_=G, 𝒜ᵨ, 𝒜ᵨ,≤G, 𝒜ᵨ,=G; with budgets 𝒜_q (base name)); `size` is a number up to 2^53 and a
decimal string above, with `sizeExact` (BigInt, non-enumerable). The conventions above (tolerance, tied optima,
empty families) apply throughout.

| Function | Contract |
|---|---|
| `enumerateReports(n, family, { reuse })` | generator of canonical grade vectors (Int8Array, labels 1..G, every label used) in lexicographic order; nothing is materialized; `reuse: true` yields one buffer; an empty family yields nothing |
| `exactOptimum(E, { tau, w, family, q, tieTol = 1e-12, maxTies = 100 })` | `{ empty: false, grade, grades, tieCount, risk, N, G, Ew, E, EoverN, evaluation, family, containsAllWithheld, tieTol, label: "exact-within-family" }` |
| `fixedOrderDP(E, { order, G, exact, blocks \| scores, direction, ids \| family, tau, w, trace, tieTol = 1e-12, maxTies = 100 })` | `{ empty: false, grade, grades, gradesOrder, tieCount, risk, N, G, Ew, E, EoverN, evaluation, order, blocks, cuts, blockCuts, saving, family, containsAllWithheld, tieTol, label: "optimal-within-order", trace? }` |
| `tauPath(E, { w, family, tieTol, maxTies = 100 })` | `{ empty: false, intervals: [{ tauFrom, tauTo, grade, N, G, Ew, E, EoverN, EwOverN, riskFrom, riskTo }], endpointOptima, endpointTieCount, family, containsAllWithheld, tieTol, label }`, intervals covering (0, 1/2] |
| `weightPath(E, { tau, family, grid, tieTol, maxTies = 100 })` | K = 2: `[{ w1, w: [w1, 1 − w1], grade, grades, tieCount, risk, N, G, Ew, E, EoverN }]` per grid weight (default 0, .05, …, 1) |
| `weightBreakpoints(E, { tau, family, tieTol })` | K = 2: `{ empty: false, intervals: [{ wFrom, wTo, grade, N, G, E, EoverN, riskFrom, riskTo }], breakpoints, tau, family, containsAllWithheld, tieTol, label }`, intervals covering [0, 1] |
| `bestReports(E, { tau, w, family, k = 1, stating = [], tieTol = 1e-12 })` | `{ family, matched, reports: [{ grade, risk, N, Ew }], tieTol, label: "exact-within-family" }`: one pass, the k smallest risks among the reports stating every `[i, j]` (i above j); ties within tieTol·(1 + \|risk\|) in enumeration order (greedy; API.md Step 7.1 notes) |
| `ENUMERATION_BUDGET` | `{ maxReports: 600000, maxUnits: 20 }` |

**Enumeration.** A depth-first walk assigns grades unit by unit in increasing label order, which visits the
canonical vectors lexicographically; a prefix is extended only if its missing labels (below the current
maximum, or below G for an exact count) still fit in the remaining positions, so every leaf is a report and no
report is visited twice. N and the pair sums (ē for the risk, E_k for budgets) are updated as each unit gets
its grade, so a report costs O(n). Order families are listed by cut sets and sorted. The budget is at most
600,000 reports on at most 20 units: n = 8 unrestricted (545,835), n = 12 with at most 3 grades (523,251), and any
small family up to n = 20 (𝒜_=1, an order family with a cap or blocks) fit. A larger family throws a RangeError
that names the limit that failed (units or reports), the family, its size, and the alternative: `fixedOrderDP`
for a declared order (also for capped and exact-count families), and the browser solver only for the
unrestricted family (CONTRACT 6.6).

**Exact optimum** (ch. 11, ch. 14): the walk minimizes Z = Ew − τN (risk = τ + Z/M). `grades` lists the reports
within `tieTol` (risk scale) of the minimum in lexicographic order, at most `maxTies`, and `tieCount` counts them
(the tied reports are packed into one typed array, so 545,835 ties at equal means cost about 40 ms and a few
megabytes). `grade` is the first of them, except for an order family, where it is the package's choice (fewer
grades, then the earlier cut): on the ch. 10 law along ABC at τ = 1/5 both 1/1/2 and 1/2/2 have risk 11/60,
enumeration and the DP both return 1/2/2, and `grades` is [1/1/2, 1/2/2]. Every other family keeps the
lexicographically first optimum (there is no package rule to follow). `risk` and the other fields are
`evaluateReport()` of `grade`. `containsAllWithheld` is true for 𝒜_n, 𝒜_≤G,
𝒜_=1 and order families without an exact count above one: only then may the bound E ≤ τN be shown (CONTRACT
6.4). **Budgets** (ch. 13, App. B 𝒜_q): `q[k]` ≥ 0 keeps the reports with E_k ≤ q_k N (residual tolerance
1e-12; null or undefined = no budget on k; N = 0 always passes). Then `family.size` is the number of reports
meeting the budgets and `family.baseSize` the base family's `familySize`. Six sites, τ = .20: 1/2/3/3/4/5 within
all 4,683 reports (N = 14, risk .0372); 1/1/2/2/3/3 within the 603 reports with at most 3 grades (risk .0417).
Three-unit law, τ = 1/5: 1/1/2 and 1/2/2, both at 11/60.

**Fixed-order DP** (ch. 14 `prp-fixed-order-dynamic-program`): along the order ρ, η_st = ē_{ρs ρt} − τ and the
block saving W(a, b) = Σ_{a<s<t≤b} η_st is built in O(n²) by W(a, b) = W(a, b − 1) + Σ_{a<s<b} η_sb (a running
column sum, no subtraction). V_h(c) = max_{h−1≤b<c} V_{h−1}(b) + W(b, c) over block boundaries, V_0(0) = 0, and
the risk is τ + (T − V)/M with T = W(0, n). Tie rules are those of `postrank_cuts(rule = "optimal")`
(`R/baselines.R`, `.pr_cuts_core`): `blocks` (sizes of the runs of equal order scores along `order`) are never
split, so cuts fall only between blocks; equal objective → fewer grades (the package's `which.min` over the
terminal values); then the lexicographically earlier vector of cut positions, kept per DP state as in
`.pr_lexicographic_less`. In exact arithmetic this selects the same report as the package. The package compares
with epsilon 0 on its own float sums; here "equal" means within `tieTol·M` on V (`tieTol` on the risk scale, as in
`exactOptimum`), so mathematically tied savings that differ by rounding are treated as ties. The two can then
return different reports: with e_AB = .1 + .2 and e_BC = .3 at τ = .25 along ABC the package (exact) gives 1/1/2
and the default tolerance gives 1/2/2. `tieTol: 0` compares exactly, as the package, for parity with R; the
result label should say which tolerance was used. The order comes from `order` (with `G`, `exact`, `blocks`),
from `scores` (+ `direction`, `ids`: `scoreOrder`), or from `family`: `{ kind: "order", order, G?, exact?,
blocks? }`, or a grade-count family (`{ kind: "atMost", G }`, `{ kind: "exactly", G }`, `{ kind: "all" }`) with a
top-level order; anything given twice throws. `order` and `blocks` of the result are the ones used. `cuts` are
unit positions (units above each cut), `blockCuts` block positions (the package's `cuts`). **Tied optima**:
`grades` holds the cut sets reached through tied choices at every DP state (in exact arithmetic, every optimal cut
set), counted by a DP over the same table (`tieCount`, a decimal string above 2^53: all 2^59 cuts of 60 equal
units tie at τ = 1/2). When tieCount·n ≤ 2·10⁷ they are all visited and the lexicographically first `maxTies` are
kept (`gradesOrder: "lexicographic"`, the same list as `exactOptimum` over the order family); above that the
first `maxTies` (at most 2·10⁶/n even with `maxTies: Infinity`) in the package's order of preference are listed
(`"package"`, fewer grades first, then earlier cuts; `grades[0]` is then `grade`). `containsAllWithheld` is true unless an exact count above one is set (CONTRACT
6.4). `trace: true` adds `{ M, T, blocks, boundaries, W, V, pred, riskByG, chosenG, path }` with null for −∞
states. Cost O(Hm²) for m blocks and H = G or `exact`, plus the same again for the tie count. The ch. 14 four-unit
example (order ABCD, weights 3/5, 2/5, τ = 1/4) gives A|BC|D, cuts 1 and 3, risk 3/20; exactly four grades give
7/40.

**τ path** (ch. 16 `prp-matched-disclosure-frontier`): risk is linear in τ for each report, so the optimum over
(0, 1/2] follows the lower convex hull of (N, min Ew) of the family; the breakpoints are the hull's edge slopes
(computed from `evaluateReport` values of the vertex reports). Intervals are closed and share endpoints (both
reports are optimal at a breakpoint); N never decreases. Each interval's report is the lexicographically first
report at that N with the smallest Ew (within tieTol·M), which is `exactOptimum`'s `grade` inside the interval.
A hull vertex that becomes optimal exactly at τ = 1/2 keeps a zero-length last interval [1/2, 1/2]: with equal
means the hull is (0, 0) and (M, M/2), and the strict report 1/2/…/n is optimal only at the endpoint (the
half-slope teaching of G-06). `endpointOptima` lists every report optimal at τ = 1/2 (lexicographic, at most
`maxTies`; there all 4,683 reports of six units tie, `endpointTieCount`). `EoverN` is per criterion (as in
`evaluateReport`), `EwOverN` = Ew/N. Six sites: breakpoints .0012, .0038, .1444, .1884, .3618 with N = 0, 8, 12,
13, 14, 15. **Weight path**: one enumeration stores E_1, E_2 and N per report; each grid weight is then one pass,
with `exactOptimum`'s tie rule. **Weight breakpoints** (K = 2, the hull analog of the τ path): with w = (w1,
1 − w1) a report's Z = E_2 − τN + w1(E_1 − E_2) is linear in w1, so the optimum over w1 ∈ [0, 1] follows the lower
hull of the points (E_2 − E_1, E_2 − τN), and the breakpoints are its edge slopes, exact up to floating point
(registry key `six.AB.cap3.tau20.wpath`). Both ends are closed, so a report optimal exactly at w1 = 0 or 1 gets a
zero-length interval there. Two units with errors .1 and .9 on opposite criteria, τ = .3: B above A on [0, 1/4],
withhold on [1/4, 3/4], A above B on [3/4, 1]. Six sites, scores A and B, at most 3 grades, τ = .20 (w1 = weight on score A): breakpoints
.0737, .1296, .4170, .6380, .7840, with 1/2/1/1/3/3, 1/2/1/2/3/3, 1/1/1/1/2/2, 1/1/1/1/2/3, 1/2/2/2/3/3 and 1/1/2/2/3/3
in turn (checked on a 2,001-point grid of exactOptimum; a zero-length tie at w1 = 0 between score B's two optima).

Timings (Node 25.8.1, Apple arm64, median of 7 runs): `exactOptimum` over all 545,835 reports of n = 8, 24 ms
(32 ms when all of them tie); over the 523,251 reports of a random 12 × 12 array with at most 3 grades, 26 ms;
`fixedOrderDP` at n = 100 with at most 5 grades, 1.1 ms (1.3 ms with trace; 16 ms without a cap), and on 20 equal
units at τ = 1/2 (all 524,288 cut sets tie, listed lexicographically) 70 ms; `exactOptimum` over that uncapped
order family of 20 units takes about 1.2 s, so use the DP for long orders; `tauPath` for the six sites, 0.2 ms;
`weightBreakpoints` for the six sites with two scores (all 4,683 reports), 1.4 ms, and for n = 8 (545,835
reports), 0.2 s; a full `enumerateReports` pass at n = 8, 45 ms (27 ms with `reuse`).

## frontier.ts: the matched-disclosure frontier

| Function | Contract |
|---|---|
| `reportCloud(E, { w, family, tieTol })` | `{ empty: false, n, M, K, w, family, containsAllWithheld, byN: [{ N, minEw, maxEw, count, minGrade, maxGrade }], points, tieTol, label }`; `points` = every `{ grade, N, Ew }` (lexicographic) only when the family has ≤ 5,000 reports, else null |
| `lowerHull(cloud, { tieTol, M })` | vertices `[{ N, Ew, grade }]` of the lower convex hull of the per-N minima (or of a list of `{ N, Ew }` points; grade null when none is given), ascending N; [] for an empty cloud |
| `supportingVertex(hull, tau, { tieTol = 1e-12, M })` | `{ vertex, vertices, value }`: every vertex whose risk is within `tieTol` of the smallest (Ew − τN within tieTol·M; M from the vertex grades, or `M` when the vertices carry none), ascending N; risk = τ + value/M |
| `matchedDisclosure(cloud, hull, N)` | `{ N, H, psi, lower, upper, best, gap }` for real N in [min N, max N] (else throws) |
| `orderHull(E, { order, G, exact, blocks \| scores, direction, ids \| family, w, tieTol })` | the hull of one order's contiguous cuts (the order as in `fixedOrderDP`); refused above `ORDER_HULL_BUDGET` |
| `halfSlopeEligible({ family, tieFree, positiveWeights })` | true only for `{ kind: "all" }` with no latent ties on positive-weight criteria |
| `reportsAtN(E, { w, family, N, k = 1, tieTol = 1e-12 })` | `{ family, N, count, reports: [{ grade, Ew }], tieTol, label }`: one pass, the k smallest Ew among the reports with exactly N stated pairs (ties as `bestReports`, on Ew); empty `reports` when count = 0 (Step 7.1) |
| `ruleGap(g, E, { w, hull, tieTol = 1e-12 })` | `{ N, Ew, H, gap, psi, lower, upper, onFrontier }`: H at the report's N (a vertex: psi null, lower = upper; else psi = (N_b − N)/(N_b − N_a) on the lower vertex), gap = Ew − H set to 0 within tieTol·M; N outside the hull throws (Step 7.1) |

**Cloud and hull** (ch. 16): each report is the point (N, Ew) (the book's A(g)); large clouds are summarized per N
and never drawn one mark per report (CONTRACT 8.8). The origin (0, 0) is in the cloud exactly when the family
contains the all-withheld report (it is the only report with N = 0). The hull is the monotone chain on the per-N
minima; a point on or above the chord of its neighbors, or below it by at most tieTol·M, is not a vertex, so
collinear points are dropped (points given without M or grades fall back to 1e-12·max(1, |Ew|)). `minGrade` and
`maxGrade` are the lexicographically first reports within tieTol·M of the final minimum and maximum at their N:
when a run of near-ties moves the minimum past the stored report, that N is settled by a second pass. Each vertex carries the report `minGrade` that attains it. Six sites, all 4,683 reports:
(0, 0), (8, .0095), (12, .0248), (13, .1692), (14, .3576), (15, .7194), every edge slope in [0, 1/2].

**Matched disclosure**: between adjacent vertices N₋ < N < N₊, ψ = (N − N₋)/(N₊ − N₋) is the weight on the upper
vertex and H = (1 − ψ)Ew₋ + ψEw₊ ("a mixture of two complete reports, not a report we can print"); at a vertex
ψ = 0 and `lower` = `upper`. `best` is the cloud's smallest Ew at exactly N (null when no report has that N, for
example a non-integer N, or when `cloud` is null) and `gap` = best.Ew − H ≥ 0. Four-unit law (weights 3/5, 2/5):
vertices (0, 0), (3, 3/10), (5, 13/20), (6, 21/20); at N = 4, ψ = 1/2, H = 19/40 and the best single report has
7/10.

**Order hull**: a DP along the withheld-pair count gives the smallest Ew at every attainable N among contiguous
cuts (cost X(a, b) of the pairs between a prefix and the next block, built from running column sums), with a
layer per grade count when there is a cap or an exact count; its lower hull is returned with one report per
vertex. It equals the hull of the enumerated order family (tested on random cases with caps, exact counts and
blocks), and its supporting vertex at τ gives the `fixedOrderDP` risk. The four-unit order DCBA gives (0, 0),
(5, 81/20), (6, 99/20): slopes above 1/2 are possible outside 𝒜_n. Memory and time grow with the table of H·m·M
cells (8 bytes for the value and 2 or 4 for the predecessor), so `ORDER_HULL_BUDGET = { maxUnitsUncapped: 150,
maxCells: 5e7 }`: without a cap at most 150 units, with a cap or exact count at most 5·10⁷ cells H·m·M; larger
inputs throw a message naming the limit, the family and its H, m and M, and pointing to `fixedOrderDP` for the
optimum at one τ. Timing: n = 30, 0.2 ms; n = 100 with at most 5 grades, 30 ms; n = 150 without a cap, 80 ms;
n = 300 with at most 3 grades (4·10⁷ cells), 0.45 s.

**Half-slope endpoint** (ch. 16 "The unrestricted half-cost endpoint"): `tieFree` is one flag, or one flag per
criterion together with `positiveWeights` (weights or flags; only criteria with a positive weight must be
tie-free). Any family other than `{ kind: "all" }` returns false, including a cap at or above n, which the
course labels "not guaranteed for this family".

## multi.ts: several criteria

Options follow risk.ts and optimize.ts (τ ∈ (0, 1/2], `w` checked not normalized, `family` default
`{ kind: "all" }`, `tieTol` default 1e-12 on the risk scale, `maxTies` default 100). Every optimum is an exhaustive
enumeration (`exactOptimum`), so families above the enumeration budget throw; empty families return
`{ empty: true, family }`.

| Function | Contract |
|---|---|
| `conflictPairs(E, { tieTol = 1e-12 })` | `{ count, pairs: [{ i, j, iAbove, jAbove }] }`: pairs i < j with e_ij,k < e_ji,k on some criterion (i more likely above: `iAbove`) and e_ij,k > e_ji,k on another (`jAbove`); equal within tieTol favors neither |
| `weightedError(E, w)` | the n × n matrix ē_ij = Σ_k w_k e_ij,k (compensated), NaN diagonal; `w` defaults to [1] when K = 1 |
| `commonalityCost(E, { w, tau, family, tieTol, maxTies })` | `{ empty: false, common, family, tau, w, criteria: [{ k, criterion, weight, commonRk, ownGrade, ownGrades, ownTieCount, ownRk, ownN, ownG, delta, relationAgreement }], containsAllWithheld, label }` |
| `estimandCosts(state, { w, a, tau, multiplier, pair, ids, criteria })` | `{ pair, c, criterionLoss, compositeLoss, criterionE, compositeE }` at a known state `state[i][k]` |
| `budgetFamily(E, { w, tau, family, q, tieTol, maxTies })` | `{ empty, size, baseSize, family, optimum, members, containsAllWithheld, label }` |
| `budgetCheck(g, E, q)` | `{ rows: [{ k, criterion, q, E, N, qN, EoverN, slack, meets }], meets }`, one row per criterion with a budget |
| `criterionMixtureRisk(g, E, { w, tau })` | `{ risk = Σ_k w_k R_k, Rk, w, weightedRisk, difference }` |
| `minimaxChoice(E, { w, tau, family, criteria, tieTol, maxTies })` | `{ empty: false, family, tau, w, included, reports, weighted: { grade, grades, tieCount, … }, minimax: { grade, grades, tieCount, value, Rk, weightedRisk }, containsAllWithheld, tieTol, label }` |
| `weightCrossing(g, E, { tau })` | K = 2: the first-criterion weight in (0, 1) where the report's risk equals τ, else null |

**Cost of a common grade** (vignette m2, `postrank_commonality_cost()`; a "package quantity"): the common
report is `exactOptimum` under w; criterion k's own optima are every report of the same family minimizing R_k
(weight e_k, same τ), all tied optima listed; Δ_k = max(0, R_k(common) − R_k(own)), the package's `cost_lower`
(the common report belongs to every own family, so the clip removes only rounding). `relationAgreement` is the
package's share of pairs with the same relation in the own and common grades. Six sites, scores A and B, w =
(1/2, 1/2), τ = .20, at most 3 grades: common 1/1/1/1/2/3 with R_A = .0906 and R_B = .0960; score A's own best
1/1/2/2/3/3 (.0417), score B's own best 1/2/1/1/3/3 and 2/2/1/2/3/3 (tied, .0816); Δ_A = .0490, Δ_B = .0145.

**Two estimands at a known state** (ch. 12): stating i above j costs Σ_k w_k 1{θ_ik ≤ θ_jk} under the weighted
criterion-direction loss and 1{c_i ≤ c_j} under the composite-direction loss, c_i = Σ_k a_k s_k θ_ik; withholding
costs τ under both (`pairDecision` gives the costs and every best action). `multiplier[k]` (s_k > 0, default 1)
multiplies criterion k before the composite; it never changes the criterion-direction costs. It was called
`scale` before Step 2.12 and was renamed because the package's `postrank_composite(scales =)` divides by its scale
(so multiplier = 1/scales); the old name now throws. `a` may be any
finite vector (the page keeps it on the simplex). `criterionE` and `compositeE` are the whole state as 0/1
ErrorArrays, so `exactOptimum` gives each loss's report. The m2 state A = (1, −2), B = (0, 0), w = (3/4, 1/4),
a = (1/2, 1/2), τ = .3 gives 1/4, 3/4, .3 and c = (−1/2, 0); with s = (1, 1/4), c_A = 1/4 and only the composite
flips.

**Budgets** (ch. 13): `budgetFamily` is `exactOptimum` with `q`, plus the members (lexicographic) when the base
family has at most 5,000 reports; `budgetCheck` evaluates one report (tolerance 1e-12, N = 0 passes). Six sites,
q_B = .02 within at most 3 grades: 2 reports (all-withheld and 1/1/1/1/2/2), optimum N = 8, risk .0939; with
exactly 3 grades the family is empty.

**Conflicts** (ch. 12): on each criterion the more likely direction is the one with the smaller error, so i is
above j when e_ij < e_ji. Under latent ties e_ij + e_ji = 1 + t_ij, and comparing with 1/2 would misread a likely
tie as the reverse direction (Pr(A > B) = .25, Pr(A = B) = .75 gives e_AB = .75 but e_BA = 1: A is the more likely
above). For tie-free inputs the two rules agree.

**Minimax** (ch. 13 sec-expected-criterion-minimax): the report minimizing max_{k ∈ K+} R_k (ties within tieTol,
lexicographic, at most maxTies with tieCount), beside the weighted optimum, with every report's criterion risks when the family has at most
5,000 reports. K+ (`criteria`, indices or ids) defaults to **every** criterion, as the package
(`minimax_criteria = NULL`) and the book (a criterion with weight 0 still counts). The ch. 13 two-unit law at
τ = 1/4 withholds at every ω, including ω = 1; guarding criterion 1 alone at ω = 1 states A above B.

**Weight crossing**: R(w) = w R_1 + (1 − w) R_2, so the crossing is w = (E_2 − τN)/(E_2 − E_1); null outside
(0, 1) and when E_1 = E_2 (the risk does not depend on w, as for all-withheld).

Timing (Node 25.8.1, Apple arm64, median of 7): `commonalityCost` on the six sites (K = 2, three exact solves),
0.18 ms within the 603 reports with at most 3 grades and 0.7 ms within all 4,683.

## rules.ts: common rules as reports

| Function | Contract |
|---|---|
| `strictOrder(scores, { direction })` | grade = position 1..n by descending score (`"ascending"`: smaller first), ties broken by unit index |
| `tierGrades(scores, G, { direction })` | `postrank_cuts(rule = "quantile")` grades (canonical) |
| `evidenceFlags(est, se, { ref = 0, crit = 1.96 })` | `{ grade, z, labels }`: z = (est − ref)/se; labels 1 (z > crit), 2, 3 (z < −crit); grade = canonical labels |
| `expectedRank(E, { w })` | Σ_k w_k {1 + Σ_{j≠i} e_ij,k}, default w = 1/K (`postrank_expected_rank()`) |

**Quantile tiers** (`R/baselines.R`, `.pr_cuts_core`): units are sorted by descending score (equal scores by id),
position p gets the raw tier 1 + ⌊(p − 1)G_b/n⌋ with G_b = min(G, n), runs of exactly equal scores (no epsilon)
are indivisible, and every raw tier that a run straddles is merged with the others it straddles, transitively
(the package's union–find), before the labels are renumbered. So [5, 4, 4, 3, 2, 1] with G = 3 gives
1/1/1/1/2/2 (the tie at positions 2–3 merges raw tiers 1 and 2 entirely), and fewer than G_b tiers can result.
The theory book's tie convention differs and is an author check; this follows the package. n = 30: G = 2, 3, 4,
5, 10 give shares .517, .690, .775, .828, .931 (sizes 8/7/8/7 for G = 4).

**Expected rank**: the inner sums run over the columns in entity-id code-point order with the diagonal set to 0,
and both sums are plain left-to-right additions (the package's `rowSums` and `%*%`), so reordering units keeps
every named score bit for bit and mathematically equal ranks stay equal (they are indivisible blocks of a
declared order in `fixedOrderDP`).

## simulate.ts: simulation and Monte Carlo

| Function | Contract |
|---|---|
| `simulateEstimates(truth, se, count, seed)` | truth + se·z with z = `normals(seed, count)` |
| `league30()` | `{ ids, size, group, se, theta, rank }` (SR-06; no randomness) |
| `drawLeague(seed = 20261030)` | `{ seed, estimate }`, θ̂_i = θ_i + SE_i·`normals(seed, 30)`[i] (`LEAGUE_SEED`; replay r uses seed + r) |
| `normalPosterior(est, se, { priorMean = 0, priorSd = .15 })` | `{ mean, sd, shrink }` (numbers or arrays); priorSd = Infinity is the flat prior |
| `normalInterval(mean, sd, level)` | `{ lower, upper }` = mean ∓ Φ⁻¹((1 + level)/2)·sd |
| `expectedMisorderedPairs(theta, se, { priorSd, priorMean = 0 })` | closed-form expected pairs ordered against θ |
| `misorderedPairs(a, b)` | `{ count, pairs }`: sign(a_i − a_j) ≠ sign(b_i − b_j) |
| `topKOverlap(a, b, k)` | `{ count, members }` of the two top-k sets (ties by index) |
| `extremeCounts(score, group, k)` | `{ k, top, bottom, total }`, each keyed by group name (first-appearance order; absent groups 0) |
| `leagueReplays(seed = 20261030, { replays = 20, k = 5, topK = 10 })` | `{ seed, replays, k, topK, seeds, draws, mean }`: replay r = 1..R is `drawLeague(seed + r)` with `extreme` (`extremeCounts` by size group), `topOverlap` and `misordered` against θ; `mean` = `{ extreme: { small, medium, large }, topOverlap, misordered }`, sums of integer counts over R |
| `rankSummaries(law)` | `{ n, means, expectedRank, rankProbs, pTop, tieFree }` for `law = { states[s][i], probs }` |
| `rankSummariesMC(means, sds, S, seed)` | the same on `gaussianDraws` with K = 1, plus `{ S, seed, label: "monte-carlo" }` |
| `krwExample1Band(tau)` | `{ tau, empty, lower, upper, pi13, states13 }` |
| `gaussianDraws(means, sds, S, seed)` | `draws[s][i][k]` (always S × n × K) |
| `mcse(trace)` | sample SD (divisor S − 1)/√S; null for fewer than two draws |
| `envelopeRadius(M, S, alpha, form = "package", { K = 1 })` | `"package"` √((log 2 + log M − log α)/(2S)); `"book"` √(log(4·M·K/α)/(2S)) over K criteria; not capped |
| `fragilePairs(draws, { tau, w, z = 2, screenMargin, grade, ids })` | `{ S, n, K, tau, w, z, screenMargin, regime, mcseMethod, pairs, summary, label }` |

**Draw order.** `gaussianDraws` consumes z = `normals(seed, S·n·K)` draw-major, then unit, then criterion:
θ[s][i][k] = means[i][k] + sds[i][k]·z[(s·n + i)·K + k]. `rankSummariesMC` uses the same draws with K = 1.

**League and posterior** (SR-06): r_i = 19i mod 31, θ_i = .15·Φ⁻¹((r_i − .5)/30), sizes 16, 64, 256 from U01,
SE = .8/√size; shrink B = σ²/(σ² + SE²) = .36, .69, .90 at σ = .15.

**Expected misordered pairs.** With t_ij = sign(θ_i − θ_j) and θ fixed, the estimate order disagrees with the
true order with probability Φ(−|θ_i − θ_j|/√(SE_i² + SE_j²)), and the posterior-mean order m + B_i(θ̂_i − m)
with Φ(−t_ij{B_i(θ_i − m) − B_j(θ_j − m)}/√(B_i²SE_i² + B_j²SE_j²)). The sign t_ij matters: shrinkage can reverse
the expected order of a pair (a small unit just above a large one), and |B_iθ_i − B_jθ_j| in its place would give
76.0 instead of 80.7 for the league. League: 88.1 (estimate order) and 80.7 (prior SD .15); a seeded Monte Carlo
of `misorderedPairs` over 2,000 replays agrees with both. A pair with equal true values counts 1.

**Rank summaries** (ch. 5): R_i = 1 + #{j : θ_j > θ_i} in each state; `rankProbs[r][i]` = Pr(R_i = r + 1) and
`pTop[k][i]` = Pr(R_i ≤ k + 1) (k-major). Finite laws use compensated sums of the state probabilities; equal
weights (and Monte Carlo) use exact counts over S. Under a tie-free law the expected rank equals
`expectedRank` (1 + Σ_j e_ij); with ties this rank is the best shared position (`tieFree` is false), which the
package's weak-error expected rank does not use. The ch. 19 law gives Pr(first) .3, .7, 0, means 6, 4, 3 and
expected ranks 2.4, 1.3, 2.3.

**KRW Example 1** (ch. 10): independent N(ω_i, 1), ω_1 = 2, ω_3 = 0. Deciding pairs alone, 1–2 and 2–3 are
withheld exactly for ω_2 in the open interval (2 − √2 z, √2 z), z = Φ⁻¹(1 − τ), and 1 above 3 is stated when
π_13 = Φ(√2) ≥ 1 − τ. The band is empty when the interval is empty (τ above about .2398) or when the rule would
not state 1 above 3 (τ below about .0786). τ = .20: (.810, 1.190); τ = .25 and τ = .05: empty.

**Monte Carlo fragility** (`postrank_mc_fragility()`, `R/mc-diagnostics.R`, IID regime): e from the draws
(share with θ_i ≤ θ_j), ē = w_1 e_1 + w_2 e_2 + … (left to right, as the package's `Reduce`), d = min(ē_ij,
ē_ji) with ties going to i, margin |d − τ|; pairs with margin below the screen z·0.5/√max(1, S − 1) are traced
(a weighted 0/1 trace has sample SD at most 0.5·√(S/(S − 1)), so no pair that could be flagged is screened out;
`screenMargin: Infinity` traces every pair); a traced pair is fragile when margin < z·MCSE of the trace
Σ_k w_k 1{θ_ak ≤ θ_bk} for its better direction a over b. MCSE is R's `sd` (mean with a correction pass, then
Σ(x − mean)²/(S − 1)) over √S, null for one draw. Rows come in the package's order (upper triangle,
column-major: (0, 1), (0, 2), (1, 2), (0, 3), …); with `grade` each row gets `relationInGrade` and the summary
`fragileDisclosed` and `fragileTied`. Six sites, score A, seed 1: A–B is fragile at S = 1,000, τ = .20 (MCSE
.0126), and C–D (ê = .36) at S = 400, τ = .35.

**Envelope radius**: the package form computes log 2 + log M − log α as `postrank_iid_bounds()` does (one
criterion at a time, per-criterion α; K does not enter it). The book form is ch. 15 `prp-iid-coefficient-envelope`,
√(log(4MK/α)/(2S)): 4MK one-sided events, equality permitted, over all K criteria at once. M = 15, α = .05: .0566
(package) and .0595 (book, K = 1) at S = 1,000, .1788 and .1883 at S = 100; the book form with K = 2 gives .0624
at S = 1,000.

Timing (Node 25.8.1, Apple arm64, median of 7): `fragilePairs` at n = 30, S = 4,000, K = 3 (league teaching
posteriors), 29 ms (18 pairs traced); `gaussianDraws` for those 360,000 values, 15 ms.

## summaries.ts: descriptive summaries of Part 1 (Step 5.14)

| Function | Contract |
|---|---|
| `summaryStats(values)` | `{ n, mean, sd }`: mean as R's `mean()` (sum/n with one correction pass), sd = √(Σ(x − mean)²/(n − 1)); sd null for n = 1 |
| `meanSquaredDistance(a, b)` | (1/n) Σ (a_i − b_i)² (compensated sum) |
| `fartherCount(estimates, posteriorMeans, truth)` | `{ count, flags, units }`: flags[i] = \|m_i − θ_i\| > \|y_i − θ_i\| (strict); units = flagged indices, ascending |
| `intervalOverlapTally(lower, upper, pi, { threshold = .9 })` | `{ n, M, threshold, apart, overlapping, high, low, pairs, best }` (below) |
| `rankIntervals(pTop, { level = .9, tieTol = 1e-12 })` | `{ level, tail, lower, upper }` (below) |

**Interval-overlap tally** (L-06). For every pair i < j (rows in the order (0, 1), (0, 2), …, (1, 2), …): the
intervals overlap when max(l_i, l_j) < min(u_i, u_j), so intervals that only touch do not; the pair's probability
is p = max(π_ij, π_ji) with π from `directionMatrix` (π_ij = Pr(θ_i > θ_j)), and its `first` unit is the one with
the larger π (i on ties). Class `apart` when the intervals do not overlap, otherwise `high` when p > threshold and
`low` when p ≤ threshold. `best` is the overlapping pair with the largest p (the earliest pair on ties), null when
no pair overlaps. For central normal intervals and threshold ≥ .5 this is exactly the widget's former tally, which
oriented each pair by posterior mean and tested the higher unit's lower end against the other's upper end. League,
prior SD .15: 36 apart, 399 overlapping, 88 high, 311 low at 90%; 22, 413, 102, 311 at 95%; the pick U13 over U05
(.988) at 90% and U03 over U15 (.997) at 95%.

**Rank intervals** (L-09). With tail = (1 − level)/2, the best end of unit i is the smallest rank r with
pTop[r − 1][i] ≥ tail − tieTol and the worst end the smallest r with pTop[r − 1][i] ≥ (1 − tail) − tieTol (null
when never reached). pTop is the rank distribution function of `rankSummaries`/`rankSummariesMC`. Monte Carlo
shares such as 200/4,000 = .05 hit the cut exactly (in double arithmetic (1 − .9)/2 is 0.04999999999999999), and
the tieTol keeps them inside. Ch. 19 law: [1, 3], [1, 2], [2, 3].

**League summaries** (L-04, frozen draw): average squared distance to θ .0163 (estimates), .0096 (posterior
means at prior SD .15), .0148 (at .05); spreads .162 (estimates), .098 and .037 (posterior means), .149 (θ); units
that end farther 14 (prior SD .15) and 17 (.05). `leagueReplays` (L-03, seeds 20261031–20261050): averages 4.35,
3.65, 2.00 (small, medium, large among the 10 extreme positions), 7.45 (top-10 overlap), 83.90 (pairs against the
true order).

## mip.ts: the browser MIP (solver bundle)

The unrestricted family 𝒜ₙ (G_max = n) only (CONTRACT 6.6); capped or exact-count families use enumeration or
the fixed-order DP. `mip.ts` is not exported from `index.ts`, so `js/pr-core.js` stays free of highs (Step 2.11
left both builds byte-identical: 86,110 bytes ES, 64,469 bytes UMD).

| Function | Contract |
|---|---|
| `createMipSolver(highs)` | a solver around one loaded highs-js instance: `{ solve(E, options), dispose(), builds }` |
| `solve(E, { tau, w, timeLimit = 30 })` | `{ grade, status, upper, lower, gap, seconds, label, family, statusCode, reused, n, M, tau, timeLimit, offset, objective, bound, nodes, evaluation, N, G, Ew, E, EoverN }`; unknown option keys throw (`mipSolve: unknown option …`), and `family.size` follows the count convention (a decimal string for 𝒜ₙ above n = 16) |
| `mipModelData(n, infinity)`, `mipCosts(ebar, n, tau)`, `mipOffset(ebar, n, tau)`, `mipColumn(n, a, b)` | the model pieces (constraints, column costs, constant C, column index) |
| `gradeFromZ(colValue, n)` | canonical grade of a solved z; throws when z is not a weak order |
| `mipStatusName(code)` | "optimal" (7), "time limit" (13), otherwise the HiGHS model status name in lower case |

**Formulation** (ch. 14 `sec-ordered-partition-formulation`, `prp-total-preorder-formulation`; Step 1.6
spike): binaries z_ab = 1{g_a ≤ g_b} (a ≠ b, column a(n − 1) + (b < a ? b : b − 1)); completeness
z_ab + z_ba ≥ 1 once per unordered pair; transitivity z_ab + z_bc − z_ac ≤ 1 for every ordered triple of distinct
units: n(n − 1) columns and C(n, 2) + n(n − 1)(n − 2) rows (n = 25: 600 columns, 14,100 rows). With
x_ij = 1 − z_ji the book's Z(g) = Σ_{i≠j}(ē_ij − τ)x_ij equals C + obj, where C = Σ_{i≠j}(ē_ij − τ) and
obj = Σ_{a≠b} z_ab(τ − ē_ba) is the HiGHS objective; ē = Σ_k w_k e_k (any K). So **upper = τ + (C + obj)/M** is the risk of the returned report (it equals `evaluateReport(grade).risk`
within 1e-12; observed ≤ 3e-16), **lower = τ + (C + bound)/M** with the HiGHS dual bound (never above obj: a bound
above the incumbent, which HiGHS does not report, would be clamped to it), and **gap = upper − lower** on the risk
scale: the book's U_R, L_R and U_R − L_R = (U_Z − L_Z)/M (ch. 14 `objective-units-determine-the-meaning-of-a-gap`).
The spike's raw objective is the same obj without C (its risk was 1 − τ + obj/M only because there
ē_ij + ē_ji = 1).

**Settings**: `mip_rel_gap = 0` and `mip_abs_gap = 0` (the defaults 1e-4 and 1e-6 allow a stop at a runner-up
within 1e-4·|obj|), `time_limit = timeLimit` per solve (`zeroAllClocks()` before each run, since the HiGHS clock
is cumulative on a persistent model), output off; all else default. HiGHS still compares objectives with
internal tolerances. Measured at τ = τ* ± d around the τ-path breakpoints τ* of 30 random 7-unit problems (358
cases per d; the two reports' objectives differ by d times their difference in N): d = 1e-11, 1e-9 and 1e-8 gave
the runner-up in 14–25% of cases, d = 1e-7 in one case, d = 3e-7 and 1e-6 never; the risk excess was at most
5e-9 (an objective difference of at most 1e-7). So two reports whose risks differ by less than about 1e-7/M may
come back either way, while `exactOptimum` separates them down to 1e-12: hence the label "optimal within solver
tolerances", never "exact".

**Persistent model**: the solver keeps the model of the last (E, w), compared by the weighted errors ē entry by
entry. A new τ only calls `changeColsCost` on all columns and runs again (`reused: true`); a new E or w disposes
the model and builds a new one (building costs about 2 ms at n = 25; the solve dominates). The acceptance test
(`tests/mip.test.ts`) wraps highs so that every model call is recorded: between two τ values the calls are
exactly `changeColsCost`, `options.set(time_limit)`, `zeroAllClocks`, `run`; the native model (`getLp()`) holds
the new costs with unchanged bounds, matrix and integrality; and status, grade, objective, bound, upper, lower and
gap are identical to a fresh model's.

**Grade recovery**: z is rounded at 1/2; unit i's grade is ordered by the number of units strictly above it
(z_ji = 1, z_ij = 0), canonicalized by `canonicalGrade`, and the recovered report's relation is checked against
every z entry.

**Status and label**: "optimal" when HiGHS reports Optimal; "time limit" when the limit stopped the solve (grade,
upper, lower and gap are those of the best report found and the bound reached, or null when HiGHS has none: with
a tiny limit there is usually no incumbent); anything else is the HiGHS status name in lower case. `label` is
"optimal-within-solver-tolerances" only for an optimal result and null otherwise, so no stopped solve is ever
labeled optimal. `family` is `familyInfo(n, { kind: "all" })` (CONTRACT 6.2: name and size always shown).

**Bundles** (`scripts/build-solver.mjs`; highs.wasm inlined as base64 and passed through the
`instantiateWasm(imports, done)` hook, since this highs build ignores `Module.wasmBinary`; the highs-js MIT
license is kept in the banner; deterministic output):

- `js/bundles/solver.js` (4,893,591 bytes): classic script, `window.PRX_SOLVER = { mipSolve, ready }`.
  `ready` (a getter) starts a blob-URL Worker on first use (script-URL workers are blocked on `file://`), sends it
  the base64 wasm, and resolves to `{ highs: "1.15.4", initSeconds }`; the blob URL is revoked afterward.
  `mipSolve(E, options)` returns a Promise of the result; requests are answered in order by one Worker that keeps
  the persistent model; validation errors reject with the same `RangeError`. An uncaught Worker error rejects
  the pending requests and terminates the Worker; the next call starts a new one. Loading the script twice keeps
  the first controller. Load it only on P-08 and X-01 after an explicit action (CONTRACT 6.3).
- `js/bundles/solver-node.mjs` (4,822,520 bytes): ES module; highs loads in-process by top-level await, then
  `mipSolve(E, options)` returns the result directly (so `await mipSolve(…)` also works); exports `ready` and
  `HIGHS_VERSION`. Import takes about 45 ms.

**Tests** (`tests/mip.test.ts`, 18): model shape; the feasible z on 4 units are exactly the 75 reports and
`gradeFromZ` inverts `weakRelation`; the objective identity on all 541 reports of 5 units (K = 2); six sites
(one score; two scores, w = (1/2, 1/2)) at τ = .15, .25, .40 equal `exactOptimum` over 𝒜₆; 18 random problems on
7 units (normal laws with K = 1, 2, 3 and random tournaments, whose LPs are fractional) at four τ (72 solves)
equal enumeration of all 47,293 reports; near ties at the τ-path breakpoints (τ* ± 1e-5, where the runner-up's
objective exceeds the optimum's by 1e-5 per extra disclosed pair, and τ* itself, where two reports tie); the Step 1.6 spike problems n = 10, 20, 30
give postrank 1.1.0's grade and risk; the persistent-model acceptance test; a tiny time limit at n = 30 gives
"time limit" with label null, then the same model solves to optimality; input checks; timings; and the built
bundles (no solver in `pr-core.js`; `solver-node.mjs` equals the source solver; `solver.js` run in a vm with a
minimal Blob, URL and Worker, including a second load and a failed Worker).

Timings (`seconds` of the result; Node 25.8.1, Apple arm64, median of 5; Chrome headless from `file://`, range
over six page loads, top level and inside an iframe; normal-law problems generated as in the Step 1.6 spike,
τ = .25, then τ = .15 (and .40 in Chrome) on the persistent model):

| n | Node, first solve | Node, τ change | Chrome Worker, first solve | Chrome Worker, τ change |
|---|---|---|---|---|
| 10 | 11 ms | 10 ms | 40–51 ms | 12–17 ms |
| 20 | 71 ms | 71 ms | 91–116 ms | 62–92 ms |
| 25 | 140 ms | 140 ms | 139–178 ms | 122–173 ms |
| 30 | 253 ms | 253 ms | 250–312 ms | 228–308 ms |

Worker start in Chrome (blob, base64 decode, wasm instantiation): 12 ms inside the Worker, 19–32 ms until `ready`
resolves; 0 network requests from `file://`, at top level and inside an iframe.

## Bundle freshness

`scripts/write-hash.mjs` writes `../js/pr-core.hash.json`, which records:

- the SHA-256 of each build source (`src/*.ts`, `package.json`, `package-lock.json`, both tsconfigs,
  `vite.config.ts`, `scripts/write-dts-entry.mjs`, `scripts/build-solver.mjs`);
- a combined source hash;
- the SHA-256 and size of each output (the pr-core builds, the declarations, and the solver bundles
  `js/bundles/solver.js` and `js/bundles/solver-node.mjs`).

The file has no time stamp, so an unchanged build rewrites the same bytes. `scripts/check-fresh.mjs` recomputes
everything and fails when any of these happens:

- a source changed, was added or was removed after the last build;
- an output differs, is missing, or was not written by the last build;
- the hash file is missing or invalid.

`--self-test` copies the files into memory, writes a matching manifest there, and injects 15 faults one at a
time (three of them on the solver: its build script, the browser bundle, the Node bundle). All 15 must be
reported. `npm test` runs it too.

## Fixtures

Each generated fixture holds its generator's full source text, plus the R or mpmath version; the spike copies are
byte-identical to `spikes/solver/`.

| File | Generator | Contents |
|---|---|---|
| `tests/fixtures/normal-r.json` | `scripts/fixtures/normal-r.R` (base R 4.6.0) | `pnorm`, `pnorm(upper)`, `dnorm` on 4,025 z (\|z\| ≤ 37: a 0.05 grid, random points, every branch boundary and its neighboring doubles); `qnorm` on 5,274 p (1e−300 … 1 − 2⁻⁵³); upper-tail `qnorm` on 1,901 p |
| `tests/fixtures/erfc-mpmath.json` | `scripts/fixtures/erfc-mpmath.py` (mpmath, 50 digits) | `erfc` on 2,471 x in [−6, 26.5]. Base R has no `erfc`, and `2 * pnorm(-sqrt(2) * x)` loses precision for large x because `sqrt(2) * x` is rounded |
| `tests/fixtures/stream-r.json` | `scripts/fixtures/stream-r.R` (base R) | the stream reimplemented from the algorithm above: integers, uniforms and normals for 8 seeds |
| `tests/fixtures/format-r.json` | `scripts/fixtures/format-r.R` (base R) | `sprintf("%.<d>f", x)` for d = 0 … 6 on exact ties, near ties, random and large values |
| `tests/fixtures/problem-n10.json`, `problem-n20.json`, `problem-n30.json`, `postrank-results.json` | copies of the Step 1.6 spike files in `spikes/solver/` (spikes are not part of the public copy) | the spike's normal-law problems (τ = .25) and postrank 1.1.0's grade and risk for each, read by `tests/mip.test.ts` |

Numbers are written with `sprintf("%.17g")` (R) or `repr` (Python), so each double is identified exactly.
