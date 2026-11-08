# Multidomain display helpers

Author: JoonHo Lee (jlee296@ua.edu).

Import from `js/shared/mdomain/index.js`. Pass the grade columns and results to display. Compute the results and check the assumptions about the posterior before calling these functions.

## Exact numbers

`formatExactText(raw, {style="fraction", digits=4})` accepts canonical nonnegative rational text, or `null` for an undefined disclosure ratio. Fraction style returns the canonical text. Decimal style rounds the rational itself half-even using BigInt, to 0–20 fixed decimal places. Exact zero is `0`; nonzero fractions below one omit the leading zero, including a display rounded to `.0000`. Display rounding never feeds a feasibility or optimizer decision.

`exactText` is an alias. `formatExactText` is also re-exported from the ordinary shared formatter for verifier lookup. `isCanonicalExact` checks reduced fraction/integer text without a Number conversion. Result strings may be longer than the separate core input parsing bound.

`exactNum(ctx, raw, options={})` returns `ctx.num(raw, display)`, preserving the exact source in `data-num`. It sets `data-prx-format="mdomain-exact"`, `data-prx-exact-style`, and `data-prx-exact-digits`. Null has raw `NA` and display `NA: no disclosure`, with the same metadata. `undefinedRatioNum` uses this same protocol.

Options include `style`, `digits`, `part` for `ctx.part`, `field` for `data-prx-mdomain-field`, `className`, `title`, and `onReadout({raw,display,node})`. Raw attributes cannot be replaced through these options. Invalid/reducible strings are rejected; presentation does not silently change a policy fraction.

## Scope and optimizer labels

- `resultScopeNode(ctx, fit, options={})`: candidate-limited full-product scope, with the examined count taken from `searchScope`. It rejects incomplete/unrestricted scope metadata. Optional `kind="fixed"`, `"stored"`, or `"subset"` labels fixed cards, saved displays or a `scope="listed_subset"` comparison.
- `optimizerSummaryNode(ctx, fit, options={})`: complete optimizer count and list, marking the supplied canonical representative. It does not select or discard a tied optimum.

Both support an optional `part` name. `candidateIdNode(ctx,id)` preserves the exact canonical `p:` key text and wraps each embedded grade integer in `ctx.num`; commas and pipes remain literal separators. It validates the canonical column syntax instead of exempting a numeric key from number-coverage checks.

## Native tables

Every table returns a DOM wrapper with `prx-data-table`, its named part, and a labeled `ctx.scrollRegion`. Append it directly. The wrapper explicitly sets `overflow-x:auto; max-width:100%; min-width:0`; `ctx.scrollRegion` supplies keyboard/overflow observation rather than the containment CSS. The table uses `width:max-content; min-width:100%; max-width:none` and nonwrapping header/data cells, retaining readable columns inside the wrapper's horizontal overflow instead of breaking words into single letters. Tables have captions, column/row headers, and wrapped numeric values; they use existing theme tokens/classes without their own color constants. All helpers preserve original ID order and do not change their inputs.

- `gradeTable(ctx, grades, options={})`: canonical unit-by-domain matrix. Optional `unitLabels`, `domainLabels`, `selectedUnit`, `onSelectUnit(id)`, `caption`, `part`.
- `profileCells(grades,{columnDomain=0,rowDomain=1})`: all domain-grade cells, including zero occupancy; each row has `rowGrade`, `columnGrade`, `count`, `members`.
- `profileGrid(ctx, grades, options={})`: readable occupancy grid, second domain on rows and first on columns by default. Options include the domain indices, labels, `selectedUnit`, `onSelectCell(cell)`, caption/part. Empty cells remain visible and selectable when a callback is supplied.
- `pairRows(grades)`: unordered pairs in original unit order, with per-domain direction `+1` when the first unit has higher reported priority, `-1` for the reverse and `0` for withheld. Classification is `neither`, `first_only`, `second_only`, `same_direction`, or `crossed`. No total ordering of profile tuples is constructed. One-domain cards use `neither` or `first_only`.
- `pairTable(ctx, grades, options={})`: complete text alternative, optionally restricted to `units:[idA,idB]`, with unit/domain labels and caption/part.
- `candidateTable(ctx, fit, options={})`: every supplied candidate row; exact risk/J, grades, feasibility, all optimal flags and canonical selection remain distinct. `jointEnabled:false` hides the J column for an unguarded presentation. `focusedId` plus `onSelectCandidate(id,row)` adds native inspection buttons; this does not recompute or change the optimizer set.

Tables use native Tab/Enter/Space interactions when callbacks are provided. An app-specific plotted candidate grid can add its own arrow-key focus behavior and use the exhaustive candidate table as its text alternative. Unit names carry `data-prx-name`; candidate keys use `candidateIdNode` so their embedded grade values retain numeric coverage. Quantitative cells carry `data-num`.

The helpers support the small live engine cards and the separate forty-site frozen grade display. Accepting a grade display here does not turn a frozen summary into a runtime engine input or establish an intended-posterior certificate.

## Comparisons of evaluated cards

`compare.js` is an application adapter, not an additional public engine export. `exactCompare` and
`exactDifference` use canonical rational strings without binary64 projection. `selectEvaluatedSubset`
compares a nonempty stated subset of feasible engine-evaluated rows, retains all minima, and follows
the engine row order for its canonical representative. Its result is explicitly `listed_subset`; it
does not claim a product-family solve or unrestricted optimality. P.1 uses this to compare its three
common diagonal cards with the same nine-card profile family under one policy.
