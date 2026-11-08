import type { GradeMatrix, MdomainInput } from "./types.ts";
/** Internal column validator; its caller supplies a freshly validated input. */
export declare function canonicalGradeVector(input: MdomainInput, raw: unknown, domainIndex: number, field?: string): number[];
/** Revalidate the current input, then own and canonicalise a named unit-by-domain card. */
export declare function mdomainGrades(input: MdomainInput, grades: GradeMatrix): GradeMatrix;
