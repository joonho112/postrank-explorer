// Parity for reportCardRows (engine/src/report.ts) against postrank 1.1.0 (r-export/12_report_card.R, group
// postrank-report-card): the row order of postrank_report_card() for each secondary order (expected_rank, mean per
// criterion, label) on the cached analyses tutorial_one, tutorial_two, toy_analysis, case_cde_12,
// analysis_30x3_tau35, case_krw_signed97 and case_alabama67, the package's ordering rule on supplied summaries with
// ties (entity id in code-point order breaks them), and sort = "grade" (input order within a grade).
// Call: reportCardRows(g, summaries, sort) with summaries = { ids, expectedRank?, mean? }; the result is the list of
// unit indices in display order. A row without args.sort omits the argument (default "expected_rank").
export default {
  group: "postrank-report-card",
  functions: ["reportCardRows"],
  run(args, pc) {
    if (args.fn !== "reportCardRows") throw new Error(`no adapter for fn ${args.fn}`);
    const r = args.sort === undefined ? pc.reportCardRows(args.g, args.summaries) : pc.reportCardRows(args.g, args.summaries, args.sort);
    return { rows: Array.from(r) };
  },
  // Row orders are exact.
  default: { abs: 0, rel: 0 },
};
