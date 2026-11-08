export type MdomainId = string;
export type Exact = string;
export type MdomainCount = number;
export type MdomainIds = Array<MdomainId>;
export type GradeVector = Array<number>;
export type CanonicalGradeVector = Array<number>;
export type GradeMatrix = {
    unitIds: Array<MdomainId>;
    domainIds: Array<MdomainId>;
    values: Array<Array<number>>;
};
export type MdomainTarget = {
    domainId: MdomainId;
    definition: string;
    units: string;
    orientation: "larger_is_higher";
    equalityClasses: Array<MdomainId>;
    equalityProvenance: string;
};
export type MdomainInputSpec = {
    inputId: MdomainId;
    lawId: MdomainId;
    representation: "exact_finite_law";
    coupling: "supplied_joint";
    unitIds: Array<MdomainId>;
    domainIds: Array<MdomainId>;
    stateIds: Array<MdomainId>;
    states: Array<Array<Array<number>>>;
    masses: Array<MdomainInputExactRecord>;
    targets: Array<MdomainTarget>;
    provenance: {
        producer: string;
        conditioningInfo: string;
        jointGeneration: string;
        finiteSupportOrigin: string;
        properLaw: true;
    };
};
export type MdomainDecision = {
    decisionId: MdomainId;
    domainIds: Array<MdomainId>;
    scope: "all_pairs";
    weights: Array<MdomainInputExactRecord>;
    tau: Array<MdomainInputExactRecord>;
    q: Array<MdomainInputExactRecord> | null;
    t: Array<MdomainInputExactRecord> | null;
    alpha: MdomainInputExactRecord;
};
export type MdomainFamilySpec = {
    familyId: MdomainId;
    unitIds: Array<MdomainId>;
    domainIds: Array<MdomainId>;
    maxGrades: Array<number>;
    maxActions: number;
    banks: Array<{
        domainId: MdomainId;
        columns: Array<{
            columnId: MdomainId;
            grades: GradeVector;
        }>;
    }>;
};
export type MdomainAssurance = {
    arithmetic: "exact_represented_finite_law";
    properLawStatus: "producer_declaration";
    numericalGuarantee: false;
    intendedPosteriorFeasibilityCertified: false;
    searchOptimality: "fixed_card" | "candidate_restricted";
};
export type MdomainDomainResult = {
    domainId: MdomainId;
    gradeCount: number;
    disclosedPairs: number;
    withheldPairs: number;
    expectedFalseCountExact: Exact;
    expectedFalseProportionExact: Exact | null;
    lossExact: Exact;
    weightedLossExact: Exact;
    meanGuardSatisfied: boolean | null;
    thresholdExact: Exact | null;
    firstExceedanceCount: number | null;
    eventProbabilityExact: Exact | null;
    eventActive: boolean;
};
export type MdomainStateResult = {
    stateId: MdomainId;
    falseCounts: Array<number>;
    exceedances: Array<boolean>;
    unionExceeded: boolean;
};
export type MdomainEvaluation = {
    inputId: MdomainId;
    lawId: MdomainId;
    decisionId: MdomainId;
    grades: GradeMatrix;
    originalPairs: number;
    riskExact: Exact;
    jointProbabilityExact: Exact;
    meanFeasible: boolean;
    jointFeasible: boolean;
    feasible: boolean;
    jointStatus: "disabled" | "analytic_zero" | "evaluated";
    domains: Array<MdomainDomainResult>;
    states: Array<MdomainStateResult>;
    assurance: MdomainAssurance;
};
export type MdomainCandidateId = string;
export type MdomainCandidateRow = {
    candidateId: MdomainCandidateId;
    grades: GradeMatrix;
    riskExact: Exact;
    jointProbabilityExact: Exact;
    meanFeasible: boolean;
    jointFeasible: boolean;
    feasible: boolean;
    disclosedCounts: Array<number>;
    gradeCounts: Array<number>;
    optimal: boolean;
    selected: boolean;
};
export type MdomainSearchScope = {
    type: "declared_cartesian_product";
    candidateCount: number;
    examinedActions: number;
    fullProductExamined: true;
    unrestrictedOptimalityClaim: false;
};
export type MdomainFit = {
    inputId: MdomainId;
    lawId: MdomainId;
    decisionId: MdomainId;
    familyId: MdomainId;
    candidateTable: Array<MdomainCandidateRow>;
    optimizerIds: Array<MdomainCandidateId>;
    selectedId: MdomainCandidateId;
    selectedGrades: GradeMatrix;
    riskExact: Exact;
    jointProbabilityExact: Exact;
    searchScope: MdomainSearchScope;
    assurance: MdomainAssurance;
};
export type MdomainComparison = {
    comparisonId: MdomainId;
    scope: "listed_subset";
    candidateIds: Array<MdomainCandidateId>;
    optimizerIds: Array<MdomainCandidateId>;
    selectedId: MdomainCandidateId;
    riskExact: Exact;
};
export type MdomainExpected = {
    fit: MdomainFit;
    selectedEvaluation?: MdomainEvaluation;
    fixedCards?: Array<{
        cardId: MdomainId;
        evaluation: MdomainEvaluation;
    }>;
    comparisons?: Array<MdomainComparison>;
};
export type MdomainOracle = {
    package: "postrank";
    packageVersion: "1.2.0";
    sourceCommit: string;
    generator: string;
    method: "public_api_exhaustive_fixed_cards";
};
export type MdomainErrorRecord = {
    code: "mdomainInputInvalid" | "mdomainIdentityMismatch" | "mdomainPolicyInvalid" | "mdomainGradesInvalid" | "mdomainFamilyInvalid" | "mdomainResourceCap" | "mdomainUnsupported";
    field: string;
    message: string;
    details?: {};
};
export type MdomainInputExactRecord = Exact;
export type MdomainFixture = {
    schemaVersion: "postrank-explorer-mdomain-v1";
    fixtureId: MdomainId;
    description?: string;
    input: MdomainInputSpec;
    decision: MdomainDecision;
    family: MdomainFamilySpec;
    expected?: MdomainExpected;
    oracle?: MdomainOracle;
};
export type MdomainInput = MdomainInputSpec;
export interface CanonicalColumn {
    columnId: string;
    aliases: string[];
    grades: number[];
}
export interface CanonicalBank {
    domainId: string;
    columns: CanonicalColumn[];
}
export interface MdomainFamily {
    sourceSpec: MdomainFamilySpec;
    constructionInput: MdomainInput;
    banks: CanonicalBank[];
    candidateCount: number;
}
