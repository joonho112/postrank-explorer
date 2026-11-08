import type { GradeMatrix, MdomainFamily, MdomainFamilySpec, MdomainInput } from "./types.ts";
/** Own supplied banks, canonicalise complete columns and count their full product. */
export declare function mdomainFamily(input: MdomainInput, spec: MdomainFamilySpec): MdomainFamily;
/** Rebuild all derived content and reject a family bound to a different full input. */
export declare function validateFamily(input: MdomainInput, family: MdomainFamily): MdomainFamily;
/** Content key for a canonical unit-by-domain matrix, with or without its IDs. */
export declare function candidateKey(card: GradeMatrix | number[][]): string;
/** Enumerate the complete bounded product, first domain most significant. */
export declare function enumerateCards(family: MdomainFamily): GradeMatrix[];
