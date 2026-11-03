import { type ErrorArray } from "./pairwise.ts";
import { type Grade } from "./report.ts";
export type ScoreDirection = "descending" | "ascending";
export interface ScoreOptions {
    /** "descending" (default): a larger score is higher priority; "ascending": a smaller score is (expected rank) */
    direction?: ScoreDirection;
}
export interface EvidenceOptions {
    /** reference value r; default 0 */
    ref?: number;
    /** cutoff c ≥ 0; a unit is flagged when |z| > c (strict); default 1.96 */
    crit?: number;
}
export interface EvidenceFlags {
    /** canonical grades: flagged above first, then not flagged, then flagged below */
    grade: Grade;
    /** z_i = (est_i − ref)/se_i */
    z: number[];
    /** the flag group of each unit: 1 above, 2 not flagged, 3 below (before canonical renumbering) */
    labels: number[];
}
/**
 * The complete report of a score order: grade = position 1..n in descending score order (a larger score is
 * higher priority; `direction: "ascending"` reverses this), equal scores broken by unit index.
 */
export declare function strictOrder(scores: ArrayLike<number>, options?: ScoreOptions): Grade;
/**
 * Fixed tiers at the package's quantile positions, exactly as postrank_cuts(rule = "quantile"): position p of
 * the descending score order gets 1 + ⌊(p − 1)G_b/n⌋ (G_b = min(G, n)); exactly equal scores are never split,
 * and every tier that a run of equal scores straddles is merged with the tiers it straddles (transitively), so
 * fewer than G_b tiers can result. Returns canonical grades. `direction: "ascending"` orders smaller first.
 */
export declare function tierGrades(scores: ArrayLike<number>, G: number, options?: ScoreOptions): Grade;
/**
 * Standardized-evidence flags read as a report: z_i = (est_i − ref)/se_i; flagged above when z_i > crit
 * (grade 1), flagged below when z_i < −crit (last grade), otherwise not flagged. Strict cutoff; canonical
 * grades. `se` is one SE per unit or one common SE (> 0).
 */
export declare function evidenceFlags(est: ArrayLike<number>, se: ArrayLike<number> | number, options?: EvidenceOptions): EvidenceFlags;
/**
 * Weighted expected ranks, exactly as postrank_expected_rank(): r_i = Σ_k w_k {1 + Σ_{j≠i} e[k][i][j]} (1 =
 * highest priority; smaller is higher). Default weights 1/K. The inner sum runs over columns in entity-id
 * code-point order and both sums are plain left-to-right additions, as the package's rowSums and %*%, so
 * mathematically equal ranks come out equal whenever the package's do (equal ranks are indivisible blocks of a
 * declared order).
 */
export declare function expectedRank(E: ErrorArray, options?: {
    w?: readonly number[];
}): number[];
