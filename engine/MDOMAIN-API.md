# Multidomain finite-law contract

This contract specifies the finite posterior laws the Explorer browser engine accepts and the results it
returns. The implementation is in `src/mdomain/`. The reference calculations use the public
**postrank 1.2.0** API. Browser requests use the schema below.

Public schema: [`schemas/mdomain.schema.json`](schemas/mdomain.schema.json).
Portable request: [`schemas/mdomain.example.json`](schemas/mdomain.example.json).
The schema describes the structure of a request. The implementation also checks the semantic rules below.
The example supplies a request that can be evaluated. The tests cover the schema keywords used here and
check the example against the semantic rules.


## Package-version reference

The P1 browser coefficients and historical reference files come from postrank
1.1.0. Explorer v3.5 checks the exports against postrank 1.2.0. The replay gate sets
`POSTRANK_LIB` to an isolated library containing postrank 1.2.0 and asserts both
that exact version and the loaded namespace path. It replays the existing scalar
report-designer and user-data exports through the unchanged public P1 functions.
This compatibility check does not regenerate or relabel historical goldens.

The new multidomain oracles independently use the postrank 1.2.0 public API. Their
source/library binding is documented in [`r-export/v35/README.md`](../r-export/v35/README.md).
The legacy exporters retain their historical default library and version binding.

## Scope and bounds

- Complete finite laws with explicit rational masses and an actual state × unit ×
  domain array. Live UI examples have two domains; one domain is supported for the
  scalar-reduction tests. Separate marginal histories and probability summaries
  are not accepted by this subset.
- Primary additive expected error–withholding loss, all-pair scopes within each
  domain, optional expected-error guards and direct joint union protection.
- Explicit supplied candidate columns only. No implicit posterior-mean ordering,
  generated cut search, bundle objective, Bonferroni comparator, MILP, draw upload,
  or iid/MCMC certification is part of this browser API.
- Hard limits: `2 <= n <= 4`, `1 <= D <= 2`, `1 <= S <= 8`, at most 256 raw supplied
  columns per domain, and at most 256 canonical product cards. A family may request
  a smaller positive `maxActions`. These are browser limits, not R-package limits.
- Reject a size excess before materializing the product. Never truncate, sample
  candidates, silently coarsen a report, or return an incumbent labeled optimal.

The 40-site display assets have their own frozen display contract. They are not
valid inputs to this API and are not enlarged exceptions to these limits.

## Portable types

All arrays retain their declared order. IDs are unique, nonblank, case-sensitive
strings within each ID vector. Do not sort, trim, normalize, recycle, align by row
labels, or infer a coupling. Repeated IDs across different namespaces are allowed.

```ts
type Exact = string; // canonical nonnegative rational text: "0", "1", "3/20"
interface GradeMatrix {
  unitIds: string[];
  domainIds: string[];
  values: number[][]; // unit × domain; raw labels are safe integers
}
interface Target {
  domainId: string;
  definition: string;
  units: string;
  orientation: "larger_is_higher";
  equalityClasses: string[]; // one explicit class label per unit
  equalityProvenance: string;
}
interface MdomainInputSpec {
  inputId: string;
  lawId: string;
  representation: "exact_finite_law";
  coupling: "supplied_joint";
  unitIds: string[];
  domainIds: string[];
  stateIds: string[];
  states: number[][][]; // state × unit × domain
  masses: Exact[];
  targets: Target[]; // exactly domainIds order
  provenance: {
    producer: string;
    conditioningInfo: string;
    jointGeneration: string;
    finiteSupportOrigin: string;
    properLaw: true;
  };
}
interface MdomainDecision {
  decisionId: string;
  domainIds: string[];
  scope: "all_pairs";
  weights: Exact[];
  tau: Exact[];
  q: Exact[] | null; // null disables all expected guards
  t: Exact[] | null; // null disables all joint guards
  alpha: Exact;
}
interface MdomainFamilySpec {
  familyId: string;
  unitIds: string[];
  domainIds: string[];
  maxGrades: number[]; // one positive integer per domain, at most n
  maxActions: number; // positive integer, at most 256
  banks: Array<{
    domainId: string;
    columns: Array<{ columnId: string; grades: number[] }>;
  }>;
}
```

State targets are finite binary64 numbers of magnitude at most
`Number.MAX_SAFE_INTEGER`. Noninteger target values mean their stored binary64
values, as in the R numeric state array; they are not parsed as decimal rational
probabilities. Exporters must preserve their round-trip values. Integer targets
are preferred for teaching fixtures. All counts, indices and raw grade labels are
safe integers. `NaN`, infinities, nonstandard JSON constants and unsafe integer
values are rejected.

`Exact` never means a JavaScript Number. Numerators and positive denominators are
parsed as BigInt, reduced by their gcd, with `0` canonicalized as `"0"` and integer
fractions written without `/1`. Portable inputs and outputs must already use that
canonical form. Input fraction text has at most 256 characters. Exact output fractions may be longer after coprime arithmetic; they are never rounded or truncated to this input budget. Decimal controls must
map an integer slider index to a declared fraction grid; do not convert a rounded
binary float into the policy. Internal signed fractions may support intermediate
arithmetic, but all quantities serialized by this schema are nonnegative.

Masses are nonnegative and sum **exactly** to one; zero-mass rows are allowed and
retained. Weights are nonnegative and sum exactly to one, with at least one positive
weight. Each `tau` is in `(0, 1/2]`; `q`, `t` and `alpha` are in `[0,1]`. Arrays have
exactly D entries, never scalar broadcasting. Every decision field is explicit;
the browser does not inherit hidden R defaults. Per-domain omitted guard rows and
custom masks are broader R features outside this first browser schema.

Structural equality is a producer declaration. In each positive-mass row, units
sharing a declared class in a domain must have identical target values. Their
grade labels must also tie. Zero-mass target rows do not establish or contradict
an almost-sure identity. Observed target ties do not create an equality class;
issuing either strict direction at a latent tie is false.

## Five core entry points

```ts
mdomainInput(spec: MdomainInputSpec): MdomainInput;
mdomainGrades(input: MdomainInput, grades: GradeMatrix): GradeMatrix;
mdomainFamily(input: MdomainInput, spec: MdomainFamilySpec): MdomainFamily;
mdomainEvaluate(input: MdomainInput, grades: GradeMatrix,
                decision: MdomainDecision): MdomainEvaluation;
mdomainSolve(input: MdomainInput, family: MdomainFamily,
             decision: MdomainDecision): MdomainFit;
```

These names are browser functions, not aliases returning R classes. `MdomainInput`
and `MdomainFamily` are validated, owning representations of these specifications.
Public functions must validate identities and current content rather than trusting
caller-added class markers. They must not mutate supplied objects or arrays. A
validated family retains its construction input specification. Solve rejects a
different input specification even if its human-readable IDs happen to match;
rebuild the family for a changed law. The browser need not reproduce an R hash
to compare its own canonical construction content.

| Browser operation | Public R reference |
|---|---|
| `mdomainInput` | `postrank_mdomain_input(..., representation="exact_finite_law", masses=...)` |
| Explicit decision binding inside evaluate/solve | `postrank_mdomain_decision(weights=..., tau=..., scope="all_pairs", q=..., t=..., alpha=...)` |
| `mdomainGrades` | Canonical input semantics of `postrank_mdomain_evaluate()`; public result grades are obtained in R with `postrank_mdomain_grades()` |
| `mdomainFamily` | `postrank_mdomain_family(columns=..., order=NULL, cuts=NULL, max_grades=..., max_actions=...)` |
| `mdomainEvaluate` | `postrank_mdomain_evaluate(..., mode="joint", keep_traces=TRUE)` |
| `mdomainSolve` | `postrank_mdomain_solve(..., max_actions=...)` |

The browser `mdomainGrades(input, suppliedGrades)` is a validator/canonicalizer,
not the R accessor signature. It checks both ordered ID dimensions, ranks the
occupied numeric labels within each column from smallest to largest as `1..K`,
preserves ties and direction, and enforces structural equality. Family grade caps
are checked when building banks. It must not repair a guard or cap violation by
merging grades. The returned matrix is in the input's original order.

An optional pure integer-cutoff helper may support a safe integer N beyond the
small engine's pair count for display tests such as N=500. That does not admit
40-unit state inputs or extend the candidate-search bounds.

## Candidate identity, enumeration and selection

A bank's `domainId`, the family `domainIds`, and its `unitIds` must match input
order exactly. Raw `columnId` labels must be unique within a bank. They identify the
input columns. The tie-break uses the integer grades described below. Canonicalize each column, reject guard/cap violations,
remove duplicate canonical columns, and add the all-withheld vector if absent.
Preserve supplied column labels as aliases when duplicates collapse.

Sort canonical columns lexicographically by their **integer grades in declared
unit order**. Enumerate their complete Cartesian product in declared domain order,
first domain most significant. Thus card comparison is lexicographic on the
flattened canonical grade matrix in **domain-major, then unit order**, matching R.

Portable `candidateId` is the content key `p:` followed by each canonical domain
column joined with commas, then columns joined with `|`. For example,
`p:1,2|1,1` is a forward S column and an all-withheld C column for two units.
This key is interpreted only with its fixture's law, ordered IDs and family.
It is not a globally unique scientific identity or an R hash.

Do **not** reproduce native R `action-*` or `column-*` serialization hashes.
The oracle enumerates the known grade matrices and evaluates each through the
public fixed-card API, assigning the portable keys itself. It cross-checks public
solver optimum risk, optimizer count and selected grades. Original R IDs may be
kept as optional audit metadata outside the portable mathematical table.

`mdomainSolve` evaluates every declared product card. Feasibility is the conjunction
of expected guards and direct joint protection. Compare feasible risks as exact
fractions, retain every equal minimum, and select the first optimizer in the
canonical order above. No tolerance, fewer-grade preference, hidden secondary
objective or arbitrary result-count cap is used. All-withheld ensures a feasible
member for this contract; no feasibility is inferred from missing information.

P.1's common-grade comparator is a **listed diagonal subset** of the same product,
under the same law and decision. Evaluate its cards and take the exact subset
minimum; it is not a Cartesian family accepted by `mdomainSolve`. Do not replace
this comparison with a P1 solver imposing different protection. Portable expected
comparisons carry the explicit subset IDs and `scope="listed_subset"`.

Permutation properties map the full optimizer sets. The lexicographic selected
representative may change after unit or domain order changes; compare that
representative to R in the new order, not to an assumed equivariant representative.

## Evaluation semantics and portable result fields

Let M be the original unordered pair count. In domain d, an issued i>j is false in
state s when `theta[s][i][d] <= theta[s][j][d]`. Let N_d be disclosed pairs and
F_sd their statewise false count. Grade 1 is highest priority; a grade tie withholds
the direction and makes no equality assertion.

```text
EF_d = sum_s mass_s F_sd
loss_d = {EF_d + tau_d (M - N_d)} / M
risk = sum_d weight_d loss_d
mean guard: EF_d <= q_d N_d
cutoff_d = floor(t_d N_d) + 1
eventActive_d = (joint guards enabled && N_d > 0 && cutoff_d <= N_d)
event_sd = (eventActive_d && F_sd >= cutoff_d)
J = sum_s mass_s 1{any enabled domain event_sd}
joint feasibility: J <= alpha
```

Both the strict event and inclusive caps use exact arithmetic. At N=0, expected
false proportion is `null`, the event is false, and the mean count guard passes.
At t=1 the cutoff is N+1, so the event is inactive. With t=null, the empty union
has J=0 and `jointStatus="disabled"`; this is not a claim of joint protection.
Zero-weight domains still contribute their enabled guards and events. All-withheld
risk is `sum_d weight_d tau_d`, not zero.

`MdomainEvaluation` contains the IDs, canonical grades, `originalPairs`,
`riskExact`, `jointProbabilityExact`, `meanFeasible`, `jointFeasible`, `feasible`,
`jointStatus`, `domains`, `states` and `assurance` as specified by the schema.
Each domain row retains disclosed/withheld counts, grade count, exact expected
false count/proportion, unweighted/weighted loss, optional guard result, threshold,
cutoff and event probability. Each state row retains false counts and same-state
exceedances in domain order plus the union indicator. A disabled guard's result
is null, not a fabricated estimate. Analytically inactive enabled events have
probability `"0"` and no hits. `jointStatus="analytic_zero"` is reserved for
enabled protection with no active component event; otherwise enabled protection
has status `"evaluated"`, even if its computed J is zero. The activity flag is
determined by the report and threshold, not by whether observed rows have hits.
Zero-mass rows remain inspectable but contribute no
expectation or probability.

`MdomainFit` contains a complete `candidateTable` with canonical grades, exact
risk/J, feasibility, disclosed/grade counts and optimizer/selection flags. It
also contains `optimizerIds`, `selectedId`, `selectedGrades`, `riskExact`,
`jointProbabilityExact`, `searchScope` and `assurance`. The table is in canonical
order. There is exactly one selected row, every and only feasible exact minimizer
is optimal, and `optimizerIds` follow table order. `searchScope` states the product
size, examined count, complete-product search and **no unrestricted-optimality
claim**. Numeric projections for display are derived from exact strings and never
feed back into decisions or ties.

## Oracle fixture and validation layers

A portable fixture has schema version `postrank-explorer-mdomain-v1`, `fixtureId`,
`input`, `decision` and `family`. Optional `expected` requires a complete `fit` and may additionally contain a
`selectedEvaluation`, fixed-card evaluations and listed-subset comparisons. An
`expected` section also requires declared `oracle` metadata; structural presence
is not proof that the declared exporter actually ran.
Optional `oracle` records the public package version, source commit and exporter.
The uncomputed example deliberately has no `expected` or `oracle` section.

R exporters must populate the array explicitly as `[state, unit, domain]`; blindly
passing nested JSON through R's column-major `array(unlist(...))` changes ordering.
Set all dimnames, target records and named policy vectors from the declared IDs.
Pass rational text through to R without converting it to double. Use q/t nulls to
disable the corresponding guards and explicitly pass all other policy values.

A schema pass alone cannot establish equal dimensions, ordered identity agreement,
canonical fraction reduction, exact sums/ranges, structural equality, candidate
keys/order, complete product coverage or optimizer correctness. Runtime semantic
validation and independent R-oracle checks must test these separately. Missing
coupling, unsupported representations/scopes, unknown fields, nonfinite values,
duplicate IDs, mismatched order and cap excess are errors, not infeasible cards.
Typed browser errors contain `code`, `field`, `message` and optional JSON-safe
`details`; consumers use codes and fields rather than parsing message prose. The
stable browser codes are `mdomainInputInvalid`, `mdomainIdentityMismatch`,
`mdomainPolicyInvalid`, `mdomainGradesInvalid`, `mdomainFamilyInvalid`,
`mdomainResourceCap` and `mdomainUnsupported`. They are browser categories, not
literal R error-code aliases. An oracle may record the actual R code separately.
Negative-case records deliberately contain invalid payloads and are kept in a
separate test ledger. Their payloads must fail the applicable structural or semantic
validation; a structural-schema pass alone does not accept an invalid law. They
are not passed off as accepted finite-law fixtures.

Minimum parity records include every candidate's exact risk/J, feasibility and
optimizer membership, plus all optimizer keys and selected grades. Boundary tests
cover zero masses/weights, N=0, latent ties, structural equality, strict equality at
threshold/cap, duplicate columns, unsafe values, cap rejection, permutations and
D=1 reduction. P1 checks use their original numerical tolerances and references.

## Assurance and display boundaries

Every core result reports `arithmetic="exact_represented_finite_law"`,
`properLawStatus="producer_declaration"`, `numericalGuarantee=false`,
`intendedPosteriorFeasibilityCertified=false` and
`searchOptimality="candidate_restricted"` for a fit (`"fixed_card"` for evaluation).
Exact arithmetic is conditional on the complete law supplied by the producer.
It is not validation of that law, a calibration result, or an intended-posterior
certificate. The browser does not implement the additional frozen-report
conditions and iid/MCMC assessment routes of `postrank_mdomain_assess()`.

P.5 separately displays the two licensed frozen 40-site records. It may recompute
occupancy and pair classes from tuples, but cannot recompute risk/J or rerun policy
selection without the original joint state law. Stored selection and diagnostic
quantities retain their different roles and all original false assurance flags.
No schema/class/hash markers may turn those summaries into engine inputs or R fits.

## Phase 4 precision clarification

The input-only `inputExact` schema carries the 256-character resource budget. The general output `exact` schema has no text-width truncation: finite-law additions and products can require wider reduced fractions. Runtime input parsers enforce the input budget; internal arithmetic and result serialization preserve the entire exact value. This is a representation clarification, not a change to losses, feasible sets or the frozen R oracles.
