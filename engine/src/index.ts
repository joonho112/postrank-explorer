// pr-core: the numerical engine of postrank Explorer.
//
// Every number a widget computes comes from here (CONTRACT.md 7). Pure functions, no DOM. Built to
// ../js/pr-core.js (ES module) and ../js/pr-core.umd.js (global `prCore`); engine/API.md lists the
// signatures and engine/README.md the definitions, sources and display rules.
//
// Modules
//   special   standard normal cdf, upper tail, density and quantile; erfc; coverage within k SEs
//   random    the one seeded stream: mulberry32 integers, open uniforms, Box–Muller normals
//   format    display precision for widgets and the number registry
//   pairwise  direction, weak-error, strict-error and equality probabilities (normal, mixture, finite law, draws),
//             margins and pair cells of a finite law, majority wins and cyclic triples, least certain pairs, pair
//             certainty counts, the difference of two (correlated) normal posteriors, the largest coefficient error
//   report    canonical grades, disclosure counts, relations and per-unit relation counts, family sizes, score
//             order and blocks, report-card row order, directions stated against scores, relation change between
//             two reports, grades from cut positions
//   risk      evaluation of a fixed report, isolated pair, confident pairs, KRW correspondence, equality-neutral
//             risk, disclosed-error estimands (with case weights), largest stated error, wrong-count distribution,
//             the claims of a strict order by distance
//   krw       scalar audience parameters, complete same-family minimizing sets and actual affine residuals
//   optimize  report enumeration, exact optimum within a family (with budgets), the k best reports, fixed-order DP,
//             τ and weight paths, weight breakpoints
//   frontier  report cloud per N, the k best reports at one N, lower hull H(m), supporting vertex, matched
//             disclosure (ψ), a report's gap to the hull, order hull, half-slope eligibility
//   multi     several criteria: conflicts, weighted errors, cost of a common grade, the two estimands, budgets,
//             criterion mixture, expected-criterion minimax, weight crossing
//   rules     common rules as reports: strict order, quantile tiers, evidence flags, weighted expected rank
//   simulate  seeded estimates and the SR-06 league and its replays, teaching posterior, misordering, rank
//             summaries, finite-law draws, KRW Example 1, Gaussian draws, MCSE, envelope radius, Monte Carlo
//             fragility; top-k overshoot, expected squared distance, weighted radius and regret bounds, the
//             two-state chain, graded league replays, transformed means, selection on draws; estimates within a
//             band, the posterior with a shared uncertain mean, the binomial MCSE, the exact law of a chain's count
//             of ones, running means
//   summaries sample mean and SD, mean squared distance, units that end farther, interval-overlap tally, rank
//             intervals

export const PR_CORE_VERSION = "0.1.0";

export { erfc, normalCdf, normalCoverage, normalPdf, normalQuantile, normalSf, type QuantileOptions } from "./special.ts";
export { normalStream, normals, rng, rngUint32, uniforms } from "./random.ts";
export {
  MINUS, NA, NO_DISCLOSURE, formatCount, formatDecimal, formatEoverN, formatFraction, formatGrades, formatPercent,
  formatProb, formatRatio, formatRational, formatRisk, formatSci, formatSetting, formatSig, formatSigned, formatSizes,
  formatTuple, rationalApprox,
  type BoundedOptions, type Bounds, type DecimalOptions, type MaybeNumber, type PercentOptions, type ProbOptions, type RatioOptions,
  type RationalOptions, type SciOptions, type SigOptions, type SignedOptions,
} from "./format.ts";
export {
  directionMatrix, drawErrors, errorArray, finiteLawCells, finiteLawMargins, finiteLawPairwise, leastCertainPairs, majorityWins,
  maxCoefficientError, mixturePairDirection, pairCertainty, pairDifference, pairDirection, tieLawPairwise,
  type DrawErrorArray, type ErrorArray, type ErrorArrayOptions, type FiniteLawCells, type FiniteLawCellsOptions, type FiniteLawMargins,
  type FiniteLawPairwise, type LabelOptions, type LeastCertainOptions, type MajorityOptions, type MajorityWins, type MarginalLaw,
  type Matrix, type MaxCoefficientError, type MixtureComponent, type PairCertainty, type PairCertaintyOptions, type PairDifference,
  type PairDirectionOptions, type TieLawPairwise, type UncertainPair, type UnitTable, type UnitValues,
} from "./pairwise.ts";
export {
  canonicalGrade, cutGrade, disclosure, familySize, pairCount, relationChange, relations, reportCardRows, scoreOrder, statedAgainst,
  unitRelationCounts, weakRelation,
  type CardSort, type CardSummaries, type CutGradeOptions, type Disclosure, type Family, type Grade, type PairRelation,
  type RelationChange, type RelationChangeOptions, type RelationChangePair, type ScoreOrder, type ScoreOrderOptions,
  type StatedAgainst, type StatedAgainstOptions, type StatedAgainstPair, type UnitRelationCounts, type WeakRelation,
} from "./report.ts";
export {
  betweenGradeErrors, claimsByDistance, confidentPairs, disclosedErrorEstimands, equalityNeutralRisk, evaluateReport, krwRisk,
  lambdaToTau, largestStatedError, pairDecision, realizedWrong, relaxedPairRisk, statedAbove, tauToLambda, wrongCountDistribution,
  type ConfidentPair, type ConfidentPairs, type DisclosedErrorEstimands, type DisclosedErrorOptions, type DisclosureCase,
  type DistanceClaims,
  type EqualityNeutralRisk, type GradePairErrors, type KrwOptions, type LargestStatedError, type PairAction, type PairDecision,
  type RealizedWrong, type ReportEvaluation, type RiskOptions, type StatedAbove, type StatedAboveOptions, type StatedPair,
  type TieInput, type WeightOptions, type WrongCountDistribution,
} from "./risk.ts";
export {
  krwBridgeParameters, krwCorrespondence,
  type KrwAxis, type KrwBridgeParameters, type KrwCorrespondence, type KrwCorrespondenceOptions, type KrwMinimizers,
} from "./krw.ts";
export {
  ENUMERATION_BUDGET, bestReports, enumerateReports, exactOptimum, fixedOrderDP, pairConstrainedOptimum, tauPath, weightBreakpoints, weightPath,
  type BestReports, type BestReportsOptions, type RankedReport, type CloudPoint, type CloudRow, type EmptyOptimum, type EmptyResult, type EnumerateOptions, type ExactOptimum,
  type FamilyLabel, type FixedOrderOptions, type FixedOrderResult, type FixedOrderTrace, type OptimumOptions,
  type OrderInputs, type PairConstrainedOptions, type PairConstraintMetadata, type PairConstrainedOptimum,
  type TauInterval, type TauPath, type TauPathOptions, type WeightBreakpoints,
  type WeightBreakpointsOptions, type WeightInterval, type WeightPathOptions, type WeightPathPoint,
} from "./optimize.ts";
export {
  ORDER_HULL_BUDGET, halfSlopeEligible, lowerHull, matchedDisclosure, orderHull, reportCloud, reportsAtN, ruleGap, supportingVertex,
  type CloudOptions, type HalfSlopeInput, type HullInput, type HullOptions, type HullVertex, type MatchedDisclosure,
  type OrderHullOptions, type ReportCloud, type ReportsAtN, type ReportsAtNOptions, type RuleGap, type RuleGapOptions,
  type SupportingVertex,
} from "./frontier.ts";
export {
  budgetCheck, budgetFamily, commonalityCost, conflictPairs, criterionMixtureRisk, estimandCosts, minimaxChoice,
  weightCrossing, weightedError,
  type BudgetCheck, type BudgetFamily, type BudgetFamilyOptions, type BudgetRow, type CommonalityCost,
  type CommonalityOptions, type CommonalityReport, type CommonalityRow, type ConflictPair, type ConflictPairs, type CriterionMixtureRisk,
  type EstimandCosts, type EstimandOptions, type MinimaxChoice, type MinimaxOptions, type MinimaxReport,
  type WeightCrossingOptions,
} from "./multi.ts";
export {
  evidenceFlags, expectedRank, strictOrder, tierGrades,
  type EvidenceFlags, type EvidenceOptions, type ScoreDirection, type ScoreOptions,
} from "./rules.ts";
export {
  LEAGUE_SEED, binomialMcse, chainCountLaw, chainMeanVariance, drawLeague, envelopeRadius, expectedMisorderedPairs,
  expectedSquaredDistance, extremeCounts, finiteLawDraws, fragilePairs, gaussianDraws, krwExample1Band, league30,
  leagueGradingReplays, leagueOvershoot, leagueReplays, mcse, misorderedPairs, normalInterval, normalPosterior, rankSummaries,
  rankSummariesMC, regretBound, runningMean, selectionOnDraws, sharedMeanPosterior, simulateEstimates, topKOverlap, topKOvershoot,
  transformedMeans, twoStateChain, weightedRadius, withinBand,
  type ChainCountLaw, type ChainCountOptions, type ChainMeanVariance, type ChainOptions, type ExpectedSquaredDistance,
  type ExtremeCounts, type FiniteLaw, type FragilePair,
  type Fragility, type FragilityOptions, type KrwBand, type League, type LeagueGradingDraw, type LeagueGradingOptions,
  type LeagueGradingReplays, type LeagueOvershoot, type LeagueOvershootDraw, type LeagueOvershootOptions, type LeagueReplayDraw,
  type LeagueReplayOptions, type LeagueReplays, type MeanTransform, type MisorderOptions, type NormalPosterior,
  type OvershootOptions, type OvershootSide, type PairList, type PosteriorOptions, type RankSummaries, type RankSummariesMC,
  type RegretBound, type RegretBoundInput, type SelectionOnDraws, type SelectionOptions, type SharedMeanOptions,
  type SharedMeanPosterior, type TopKOverlap, type TopKOvershoot, type TransformLaw, type TransformOptions, type TransformedMeans,
  type TwoStateChain, type TwoStateChainOptions, type WithinBand, type WithinBandOptions,
} from "./simulate.ts";
export {
  fartherCount, intervalOverlapTally, meanSquaredDistance, rankIntervals, summaryStats,
  type FartherCount, type OverlapClass, type OverlapOptions, type OverlapPair, type OverlapTally, type RankIntervalOptions,
  type RankIntervals, type SummaryStats,
} from "./summaries.ts";

export {
  tierSizeDistribution, reportInformation, thresholdViolations, compareReportLosses, allocationValue, thresholdClassification,
  type TierSizeDistribution, type ThresholdViolationKind, type ThresholdViolation, type ThresholdViolationOptions,
  type ThresholdViolations, type CompareReportLossOptions, type ComparedReportLosses, type AllocationOptions,
  type AllocationValue, type ClassificationOptions, type ThresholdClassification,
} from "./decision.ts";

export {
  normalComposite, compareReports, protectionEnvelopes,
  type NormalCompositeOptions, type NormalComposite, type CompareReportsOptions, type CompareReports,
  type CompareReportPair, type ProtectionEnvelopeOptions, type ProtectionEnvelopes, type ProtectionEnvelopeRow,
  type ProtectionMembership, type ProtectionSlack, type CoefficientCheck, type ActualBracketInclusions,
} from "./criteria.ts";
