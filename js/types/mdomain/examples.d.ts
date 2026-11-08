import type { MdomainFixture } from "./types.ts";
export type MdomainExampleKind = "common" | "separable" | "dependence" | "resolution";
export interface MdomainCommonExampleOptions {
    law?: "aligned" | "crossed";
    tauIndex?: number;
    weightIndex?: number;
}
export interface MdomainSeparableExampleOptions {
    couplingIndex?: number;
    zeroWeight?: boolean;
    protected?: boolean;
}
export interface MdomainDependenceExampleOptions {
    couplingIndex?: number;
}
export interface MdomainResolutionExampleOptions {
    noiseIndex?: number;
    budgetIndex?: number;
}
export interface MdomainExampleOptions {
    common: MdomainCommonExampleOptions;
    separable: MdomainSeparableExampleOptions;
    dependence: MdomainDependenceExampleOptions;
    resolution: MdomainResolutionExampleOptions;
}
/**
 * Build an uncomputed finite-law request for one of the four live teaching apps.
 * Every call owns its arrays. Control indexes select declared rational grids;
 * no result, optimiser, fitted-object marker or oracle record is attached.
 * Invalid controls produce typed mdomainInputInvalid errors before scientific validation.
 */
export declare function mdomainExample<K extends MdomainExampleKind>(kind: K, supplied?: MdomainExampleOptions[K]): MdomainFixture;
