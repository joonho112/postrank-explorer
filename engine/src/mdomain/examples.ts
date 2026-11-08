// Author: JoonHo Lee (jlee296@ua.edu).
// Complete teaching-law requests only. No fitted results or oracle values are imported.
import type { MdomainDecision, MdomainFixture } from "./types.ts";
import { rational, toExact } from "./rational.ts";
import { fail } from "./error.ts";

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
export interface MdomainDependenceExampleOptions { couplingIndex?: number }
export interface MdomainResolutionExampleOptions { noiseIndex?: number; budgetIndex?: number }
export interface MdomainExampleOptions {
  common: MdomainCommonExampleOptions;
  separable: MdomainSeparableExampleOptions;
  dependence: MdomainDependenceExampleOptions;
  resolution: MdomainResolutionExampleOptions;
}

const TAU_GRID = ["1/20", "1/10", "1/4"] as const;
const BUDGET_GRID = ["0", "1/40", "1/20", "3/40", "1/10", "1/8", "3/20"] as const;
const KEYS: Record<MdomainExampleKind, readonly string[]> = {
  common: ["law", "tauIndex", "weightIndex"],
  separable: ["couplingIndex", "zeroWeight", "protected"],
  dependence: ["couplingIndex"],
  resolution: ["noiseIndex", "budgetIndex"],
};

type Options = Record<string, unknown>;
function optionsFor(kind: MdomainExampleKind, supplied: unknown): Options {
  if (supplied === undefined) return {};
  if (supplied === null || typeof supplied !== "object" || Array.isArray(supplied)) {
    fail("mdomainInputInvalid", "options", "Teaching-example options must be an object.");
  }
  const prototype = Object.getPrototypeOf(supplied);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("mdomainInputInvalid", "options", "Teaching-example options must be a plain object.");
  }
  const options = supplied as Options;
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== "string") fail("mdomainInputInvalid", "options", "Teaching-example controls require string keys.");
    if (!KEYS[kind].includes(key)) fail("mdomainInputInvalid", `options.${key}`, `Unknown ${kind} example option: ${key}.`);
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (descriptor && ("get" in descriptor || "set" in descriptor))
      fail("mdomainInputInvalid", `options.${key}`, "Teaching-example controls must be plain data values.");
  }
  return options;
}
function index(options: Options, key: string, fallback: number, minimum: number, maximum: number): number {
  const value = options[key] === undefined ? fallback : options[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail("mdomainInputInvalid", `options.${key}`, `${key} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}
function boolean(options: Options, key: string, fallback: boolean): boolean {
  const value = options[key] === undefined ? fallback : options[key];
  if (typeof value !== "boolean") fail("mdomainInputInvalid", `options.${key}`, `${key} must be a boolean.`);
  return value;
}
function exact(numerator: number, denominator: number): string {
  return toExact(rational(BigInt(numerator), BigInt(denominator)));
}
function couplingMasses(couplingIndex: number): string[] {
  return [exact(80 + couplingIndex, 100), exact(10 - couplingIndex, 100),
    exact(10 - couplingIndex, 100), exact(couplingIndex, 100)];
}
function fixture(kind: MdomainExampleKind, settingsId: string, lawId: string,
  stateIds: string[], rows: number[][], masses: string[],
  policy: Pick<MdomainDecision, "weights" | "tau" | "t" | "alpha">): MdomainFixture {
  const unitIds = ["A", "B"];
  const domainIds = ["S", "C"];
  const id = `example-${kind}-${settingsId}`;
  return {
    schemaVersion: "postrank-explorer-mdomain-v1",
    fixtureId: id,
    description: `Complete two-unit, two-domain finite teaching law for the ${kind} illustration.`,
    input: {
      inputId: `${lawId}-input`, lawId,
      representation: "exact_finite_law", coupling: "supplied_joint",
      unitIds: [...unitIds], domainIds: [...domainIds], stateIds: [...stateIds],
      states: rows.map(row => [[...row], [0, 0]]), masses: [...masses],
      targets: domainIds.map(domainId => ({ domainId,
        definition: `Fictional ${domainId} priority coordinate`, units: "illustrative score",
        orientation: "larger_is_higher", equalityClasses: [...unitIds],
        equalityProvenance: "The model declares no shared target identity between A and B." })),
      provenance: {
        producer: "JoonHo Lee: self-contained fictional teaching law",
        conditioningInfo: "Specified finite law; no fitted observations or sampled posterior draws.",
        jointGeneration: "Each labelled state contains both units and both domains together.",
        finiteSupportOrigin: "The listed matrices exhaust this declared law, including zero-mass rows.",
        properLaw: true,
      },
    },
    decision: {
      decisionId: `${id}-policy`, domainIds: [...domainIds], scope: "all_pairs",
      weights: [...policy.weights], tau: [...policy.tau], q: null,
      t: policy.t === null ? null : [...policy.t], alpha: policy.alpha,
    },
    family: {
      familyId: "teaching-two-domain-nine-cards", unitIds: [...unitIds], domainIds: [...domainIds],
      maxGrades: [2, 2], maxActions: 9,
      banks: domainIds.map(domainId => ({ domainId, columns: [
        { columnId: "withhold", grades: [1, 1] },
        { columnId: "forward", grades: [1, 2] },
        { columnId: "reverse", grades: [2, 1] },
      ] })),
    },
  };
}

/**
 * Build an uncomputed finite-law request for one of the four live teaching apps.
 * Every call owns its arrays. Control indexes select declared rational grids;
 * no result, optimiser, fitted-object marker or oracle record is attached.
 * Invalid controls produce typed mdomainInputInvalid errors before scientific validation.
 */
export function mdomainExample<K extends MdomainExampleKind>(kind: K,
  supplied?: MdomainExampleOptions[K]): MdomainFixture {
  if (typeof kind !== "string" || !Object.hasOwn(KEYS, kind)) {
    fail("mdomainInputInvalid", "kind", "Unknown multidomain teaching example.");
  }
  const options = optionsFor(kind, supplied);
  if (kind === "common") {
    const law = options.law === undefined ? "crossed" : options.law;
    if (law !== "aligned" && law !== "crossed") fail("mdomainInputInvalid", "options.law", "law must be aligned or crossed.");
    const tauIndex = index(options, "tauIndex", 2, 0, 2);
    const weightIndex = index(options, "weightIndex", 0, 0, 1);
    return fixture(kind, `${law}-t${tauIndex}-w${weightIndex}`, `common-${law}-law`,
      ["usual", "reversal"], law === "aligned" ? [[1, 1], [-1, -1]] : [[1, -1], [-1, 1]],
      ["9/10", "1/10"], { weights: weightIndex === 0 ? ["1/2", "1/2"] : ["9/10", "1/10"],
        tau: [TAU_GRID[tauIndex], TAU_GRID[tauIndex]], t: null, alpha: "3/20" });
  }
  if (kind === "separable") {
    const couplingIndex = index(options, "couplingIndex", 10, 0, 10);
    if (![0, 1, 10].includes(couplingIndex)) fail("mdomainInputInvalid", "options.couplingIndex", "Separable couplingIndex must be 0, 1 or 10.");
    const zeroWeight = boolean(options, "zeroWeight", false);
    const protectedMode = boolean(options, "protected", false);
    return fixture(kind, `c${couplingIndex}-z${Number(zeroWeight)}-p${Number(protectedMode)}`,
      `separable-c${couplingIndex}-law`, ["++", "-+", "+-", "--"],
      [[1, 1], [-1, 1], [1, -1], [-1, -1]], couplingMasses(couplingIndex),
      { weights: zeroWeight ? ["0", "1"] : ["1/2", "1/2"], tau: ["1/4", "1/4"],
        t: protectedMode ? ["0", "0"] : null, alpha: "3/20" });
  }
  if (kind === "dependence") {
    const couplingIndex = index(options, "couplingIndex", 10, 0, 10);
    return fixture(kind, `c${couplingIndex}`, `dependence-c${couplingIndex}-law`,
      ["++", "-+", "+-", "--"], [[1, 1], [-1, 1], [1, -1], [-1, -1]],
      couplingMasses(couplingIndex), { weights: ["1/2", "1/2"], tau: ["1/4", "1/4"],
        t: ["0", "0"], alpha: "3/20" });
  }
  const noiseIndex = index(options, "noiseIndex", 1, 0, 2);
  const budgetIndex = index(options, "budgetIndex", 3, 0, 6);
  return fixture("resolution", `k${noiseIndex}-a${budgetIndex}`, `resolution-k${noiseIndex}-law`,
    ["s1", "s2", "s3"], [[1, 1], [-1, 1], [1, -1]],
    [exact(20 - 3 * noiseIndex, 20), exact(noiseIndex, 20), exact(noiseIndex, 10)],
    { weights: ["1/4", "3/4"], tau: ["1/4", "1/4"], t: ["0", "0"],
      alpha: BUDGET_GRID[budgetIndex] });
}
