# Explorer v3.5 R oracles

Author: JoonHo Lee <jlee296@ua.edu>.

These exporters use postrank **1.2.0** in a fresh R process. Run from the Explorer
repository root. `POSTRANK_LIB` defaults to `.R-library-v35/`; `POSTRANK_SRC`
defaults to the read-only sibling `postrank-R-package-public/`. `_paths.R` checks
the installed version, loaded namespace path, source version, clean tracked source
and source commit. It does not install packages or alter the older 1.1.0 library.


## Package versions and scalar replay

The existing P1 reference files identify **postrank 1.1.0** as the package used to
generate them. The historical environment uses `r-export/_paths.R` and `.R-library/`.
The v3.5 compatibility gate reads the saved references and runs the exports with 1.2.0.

The new v3.5 R oracles use **1.2.0** as described above. In addition, two portable
export suites replay existing scalar report-designer/user-data scripts against
the 1.2.0 public API:

```sh
POSTRANK_LIB="$PWD/.R-library-v35" node --test \
  verification/tests/report-designer.test.mjs \
  verification/tests/your-data-r-export.test.mjs
```

Run from the repository root in a working Node environment. Each spawned fresh R
process prepends the supplied library, requires postrank 1.2.0, explicitly loads
from that directory, and checks the loaded namespace path. A different installed
version or namespace is an error; the replay does not fall back silently. Its
assertions preserve every released coefficient, supplied marginal, tau, weight,
report grade and applicable evaluation comparison at the original precision.

For these two replay suites only, **unset** `POSTRANK_LIB` retains the historical
root `.R-library/` default and explicitly expects 1.1.0. Supplying the variable
selects the v3.5 compatibility contract and therefore requires 1.2.0. The v3.5
gate must always supply the variable; successful default/legacy replay alone is
not a v3.5 compatibility receipt. Exported user scripts retain their public
`library(postrank)` interface; this selection/preflight belongs to the verification
harness rather than a machine-specific path inserted into a download.

## Public portable schema

The public request schema and uncomputed example are
[`engine/schemas/mdomain.schema.json`](../../engine/schemas/mdomain.schema.json)
and [`engine/schemas/mdomain.example.json`](../../engine/schemas/mdomain.example.json).
They are byte-identical copies of the frozen Phase 2 development contract, with
its stable schema ID unchanged. Local validation checks the structural keywords
actually used by these files and separately checks array dimensions, ordered IDs,
canonical rational sums/ranges, structural equality and candidate bounds. This is
not a claim that a standards-complete JSON Schema validator was run, or that a
structurally valid request has a correct optimizer. Public-R parity and runtime
semantic checks remain distinct gates.

## Shared interface

```r
source("r-export/v35/_oracle.R")
request <- v35_read_fixture("path/to/request.json")
result <- v35_oracle_fixture(
  request,
  generator = "r-export/v35/my-exporter.R",
  comparisons = list(list(
    comparisonId = "common-diagonal",
    candidateIds = v35_common_candidate_ids(request)
  )),
  fixed_cards = "all"
)
v35_write_fixture(result, "path/to/new-v35-fixture.json")
```

`v35_oracle_fixture()` accepts a schema-valid, uncomputed request and returns the
same request plus `expected` and `oracle`. It evaluates the full canonical product
through the public fixed-card API, forms its exact optimizer set using gmp, and
cross-checks the public solver's complete candidate table, selected grades and
optimizer count. No TypeScript output informs these calculations. Portable
candidate IDs are domain-major canonical grade keys, not native R action hashes.

- `fixed_cards="all"` emits all candidates as `expected.fixedCards`, each with
  `cardId=<portable candidate key>` and a full `evaluation`.
- Otherwise `fixed_cards` is a list of records with `cardId` and a portable
  `grades` matrix (`unitIds`, `domainIds`, unit-major `values`). An empty list
  omits this optional field.
- `comparisons` is a list of records containing `comparisonId` and `candidateIds`.
  The helper takes the exact feasible minimum on each explicit subset; it never
  changes the policy or pretends a diagonal-only subset is a Cartesian family.
- `v35_common_candidate_ids()` accepts an uncomputed request, a completed fixture,
  or a portable fit and returns the common-column candidate keys.
- `v35_candidate_matrices(request)` returns the canonical candidate matrices,
  named by portable key. `v35_grade_record(matrix)` and `v35_candidate_key(matrix)`
  provide the corresponding portable matrix and key.
- `v35_bind_fixture(request)` is available for generator-specific assertions and
  negative-input experiments. Its R objects are local working values, not JSON
  payloads. Do not serialize them or use private native fields as a fixture API.

State arrays are populated explicitly as `[state, unit, domain]`. Policy vectors,
grade dimensions and equality classes carry the declared IDs. The helper derives
statewise false counts independently from the supplied states and public verified
grades, then checks exact weighted counts and event/union probabilities against
public result tables. It exports no native R trace or hash schema.

Every JSON array is a list, including one-element domain, optimizer, count and
matrix-row arrays. `v35_write_fixture()` uses round-trip numeric output; exact
masses, policy and expected quantities remain fraction strings. Numeric projections
never determine feasibility or ties.

## Explicit nulls and assurance

The request must retain every required decision field. In R, use
`decision["t"] <- list(NULL)` to disable joint guards, and the same pattern for q.
`decision$t <- NULL` removes the field; it does not write a JSON null. Missing t
can also trigger R's partial `$` match against tau. The adapter therefore rejects
missing policy fields before binding the public API.

The engine scope is complete finite teaching laws, at most 4 units, 2 domains,
8 states and 256 product cards. One domain is retained for reduction tests.
Draw-based inputs, custom scopes and frozen 40-site display records are outside
this runtime request contract. Empty disclosed sets retain null error ratios;
analytically inactive protection differs from active events with zero computed
probability. Exact results remain conditional on the producer's declared finite
law and carry no intended-posterior certificate.

Local replay checks write reports to `verification/report/v35-oracle/`.
Historical golden values and their source-generation manifests are not rewritten.
