import { type ErrorArray } from "./pairwise.ts";
import { type Grade } from "./report.ts";
import { type ReportEvaluation } from "./risk.ts";
import { type FamilyLabel } from "./optimize.ts";
export interface HighsSparseMatrix {
    format: "csr";
    numRows: number;
    numCols: number;
    starts: Int32Array;
    indices: Int32Array;
    values: Float64Array;
}
/** highs-js ModelData for the weak-order MIP (binary columns, CSR rows). */
export interface MipModelData {
    numCols: number;
    numRows: number;
    colCost: Float64Array;
    colLower: Float64Array;
    colUpper: Float64Array;
    rowLower: Float64Array;
    rowUpper: Float64Array;
    matrix: HighsSparseMatrix;
    integrality: Int32Array;
}
export interface HighsModelLike {
    options: {
        set(values: Record<string, number | boolean | string>): unknown;
    };
    info: {
        get(name: string): unknown;
    };
    changeColsCost(selection: {
        kind: "range";
        from: number;
        to: number;
    }, costs: Float64Array): unknown;
    zeroAllClocks(): unknown;
    run(): unknown;
    getModelStatus(): number;
    getObjectiveValue(): number;
    getSolution(): {
        colValue: ArrayLike<number>;
    };
    dispose(): void;
}
export interface HighsLike {
    /** the value highs-js uses for an infinite bound */
    infinity: number;
    createModel(data: MipModelData): HighsModelLike;
    version?: string;
}
export interface MipOptions {
    /** withholding cost, 0 < τ ≤ 1/2 */
    tau: number;
    /** criterion weights (length K, ≥ 0, sum 1); default [1] when K = 1 */
    w?: readonly number[];
    /** HiGHS time_limit in seconds for this solve (> 0; Infinity allowed); default 30 */
    timeLimit?: number;
}
export type MipLabel = "optimal-within-solver-tolerances";
export interface MipResult {
    /** canonical grade vector of the returned report; null when HiGHS has no feasible solution */
    grade: Grade | null;
    /** "optimal", "time limit", or another HiGHS model status name in lower case */
    status: string;
    /** τ + (C + obj)/M: the risk of the returned report; null when there is none */
    upper: number | null;
    /** τ + (C + bound)/M (≤ upper); null when HiGHS has no finite bound */
    lower: number | null;
    /** upper − lower (absolute, risk scale); null when either is null */
    gap: number | null;
    /** wall-clock seconds of this call (model build or objective update, solve, recovery) */
    seconds: number;
    /** the result label (CONTRACT 6.2) for an optimal result; null for any other status */
    label: MipLabel | null;
    /** the unrestricted family 𝒜_n (CONTRACT 6.6); size a number up to 2^53, else a decimal string */
    family: FamilyLabel;
    /** HiGHS model status code (7 = Optimal, 13 = Time limit reached) */
    statusCode: number;
    /** true when the persistent model of the same (E, w) was reused (only the costs changed) */
    reused: boolean;
    n: number;
    M: number;
    tau: number;
    timeLimit: number;
    /** C = Σ_{i≠j}(ebar_ij − τ), the constant that turns the HiGHS objective into Z */
    offset: number;
    /** HiGHS objective obj = Σ z_ab(τ − ebar_ba) of the returned solution; null when there is none */
    objective: number | null;
    /** HiGHS dual bound on obj (not above objective); null when not finite */
    bound: number | null;
    /** branch-and-bound nodes */
    nodes: number | null;
    /** evaluateReport() of grade, and its main fields (null when grade is null) */
    evaluation: ReportEvaluation | null;
    N: number | null;
    G: number | null;
    Ew: number | null;
    E: number[] | null;
    EoverN: (number | null)[] | null;
}
export interface MipSolver {
    /** Optimal report over 𝒜_n at τ; reuses the model when (E, w) equals the previous call's. */
    solve(E: ErrorArray, options: MipOptions): MipResult;
    /** Dispose the persistent model (the solver stays usable; the next solve builds a new model). */
    dispose(): void;
    /** number of models built so far (for the persistent-model acceptance test) */
    readonly builds: number;
}
/** Extra HiGHS options for tests only (for example the default gaps, to show why they are set to 0). */
export interface MipSolverSettings {
    highsOptions?: Record<string, number | boolean | string>;
}
export declare const MIP_LABEL: MipLabel;
export declare const MIP_DEFAULT_TIME_LIMIT = 30;
/** Column of z_ab (a ≠ b): a(n − 1) + (b < a ? b : b − 1). */
export declare function mipColumn(n: number, a: number, b: number): number;
/** Status string for a HiGHS model status code: "optimal", "time limit", else the HiGHS name in lower case. */
export declare function mipStatusName(code: number): string;
/**
 * The constraint part of the model on n units: n(n − 1) binary columns, C(n, 2) completeness rows and
 * n(n − 1)(n − 2) transitivity rows (CSR). Costs are zero; mipCosts() supplies them.
 */
export declare function mipModelData(n: number, infinity: number): MipModelData;
/** Column costs τ − ebar_ba for z_ab (ebar flat, ebar[i·n + j]). */
export declare function mipCosts(ebar: ArrayLike<number>, n: number, tau: number): Float64Array;
/** C = Σ_{i≠j}(ebar_ij − τ), compensated. */
export declare function mipOffset(ebar: ArrayLike<number>, n: number, tau: number): number;
/**
 * Canonical grade from a solved z (column values, rounded at 1/2): unit i's grade is ordered by the number of
 * units strictly above it (z_ji = 1, z_ij = 0). Throws when z is not a complete, transitive relation.
 */
export declare function gradeFromZ(colValue: ArrayLike<number>, n: number): Grade;
/**
 * A MIP solver around one highs-js instance (loaded by the caller: the Worker in solver.js, the module in
 * solver-node.mjs, or a test). It keeps the model of the last (E, w) and changes only the costs when τ moves.
 */
export declare function createMipSolver(highs: HighsLike, settings?: MipSolverSettings): MipSolver;
