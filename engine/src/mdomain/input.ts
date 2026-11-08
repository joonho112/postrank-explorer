// Author: JoonHo Lee (jlee296@ua.edu).

import { fail } from "./error.ts";
import { ZERO, ONE, add, cmp, parseExact, toExact } from "./rational.ts";
import { strictRecord, exactKeys, exactArray, nonblankString, orderedIds } from "./validation.ts";
import type { MdomainInput, MdomainInputSpec, MdomainTarget } from "./types.ts";

const INPUT_FIELDS = ["inputId", "lawId", "representation", "coupling", "unitIds", "domainIds", "stateIds", "states", "masses", "targets", "provenance"] as const;
const TARGET_FIELDS = ["domainId", "definition", "units", "orientation", "equalityClasses", "equalityProvenance"] as const;
const PROVENANCE_FIELDS = ["producer", "conditioningInfo", "jointGeneration", "finiteSupportOrigin", "properLaw"] as const;

function boundedIds(value: unknown, field: string, minimum: number, maximum: number): string[] {
  if (!Array.isArray(value) || value.length < minimum) {
    fail("mdomainInputInvalid", field, "The declared dimension is too small.", { minimum });
  }
  if (value.length > maximum) {
    fail("mdomainResourceCap", field, "The declared dimension exceeds the browser limit.", { maximum });
  }
  return orderedIds(value, field, "mdomainInputInvalid");
}

/** Own and validate the current complete finite-law specification, without class markers. */
export function mdomainInput(spec: MdomainInputSpec): MdomainInput {
  const record = strictRecord(spec, "input", "mdomainInputInvalid");
  exactKeys(record, INPUT_FIELDS, "input", "mdomainInputInvalid");
  if (record.representation !== "exact_finite_law") {
    fail("mdomainUnsupported", "input.representation", "Only complete exact finite laws are supported.");
  }
  if (record.coupling !== "supplied_joint") {
    fail("mdomainUnsupported", "input.coupling", "An explicit supplied joint-state coupling is required.");
  }

  const inputId = nonblankString(record.inputId, "input.inputId", "mdomainInputInvalid");
  const lawId = nonblankString(record.lawId, "input.lawId", "mdomainInputInvalid");
  const unitIds = boundedIds(record.unitIds, "input.unitIds", 2, 4);
  const domainIds = boundedIds(record.domainIds, "input.domainIds", 1, 2);
  const stateIds = boundedIds(record.stateIds, "input.stateIds", 1, 8);
  const n = unitIds.length;
  const D = domainIds.length;
  const S = stateIds.length;

  const masses = exactArray(record.masses, S, "input.masses", "mdomainInputInvalid").map((value, i) =>
    parseExact(value, `input.masses[${i}]`, "mdomainInputInvalid"));
  const total = masses.reduce((sum, mass) => add(sum, mass), ZERO);
  if (cmp(total, ONE) !== 0) {
    fail("mdomainInputInvalid", "input.masses", "Finite-law masses must sum exactly to one.");
  }

  const states: number[][][] = [];
  const stateRows = exactArray(record.states, S, "input.states", "mdomainInputInvalid");
  for (let s = 0; s < S; s += 1) {
    const units = exactArray(stateRows[s], n, `input.states[${s}]`, "mdomainInputInvalid");
    const state: number[][] = [];
    for (let i = 0; i < n; i += 1) {
      const coordinates = exactArray(units[i], D, `input.states[${s}][${i}]`, "mdomainInputInvalid");
      const row: number[] = [];
      for (let d = 0; d < D; d += 1) {
        const value = coordinates[d];
        if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
          fail("mdomainInputInvalid", `input.states[${s}][${i}][${d}]`, "A finite binary64 target within the safe magnitude bound is required.");
        }
        row.push(value);
      }
      state.push(row);
    }
    states.push(state);
  }

  const targets: MdomainTarget[] = [];
  const targetRows = exactArray(record.targets, D, "input.targets", "mdomainInputInvalid");
  for (let d = 0; d < D; d += 1) {
    const field = `input.targets[${d}]`;
    const target = strictRecord(targetRows[d], field, "mdomainInputInvalid");
    exactKeys(target, TARGET_FIELDS, field, "mdomainInputInvalid");
    const domainId = nonblankString(target.domainId, `${field}.domainId`, "mdomainInputInvalid");
    if (domainId !== domainIds[d]) {
      fail("mdomainIdentityMismatch", `${field}.domainId`, "Targets must follow the input's domain order.");
    }
    if (target.orientation !== "larger_is_higher") {
      fail("mdomainInputInvalid", `${field}.orientation`, "Targets must already be oriented larger-is-higher.");
    }
    const equalityClasses = exactArray(target.equalityClasses, n, `${field}.equalityClasses`, "mdomainInputInvalid")
      .map((value, i) => nonblankString(value, `${field}.equalityClasses[${i}]`, "mdomainInputInvalid"));
    for (let s = 0; s < S; s += 1) {
      if (cmp(masses[s], ZERO) === 0) continue;
      const classValues = new Map<string, number>();
      for (let i = 0; i < n; i += 1) {
        const label = equalityClasses[i];
        if (classValues.has(label) && classValues.get(label) !== states[s][i][d]) {
          fail("mdomainInputInvalid", `${field}.equalityClasses`, "A declared structural identity is violated in a positive-mass state.", { stateId: stateIds[s] });
        }
        classValues.set(label, states[s][i][d]);
      }
    }
    targets.push({
      domainId,
      definition: nonblankString(target.definition, `${field}.definition`, "mdomainInputInvalid"),
      units: nonblankString(target.units, `${field}.units`, "mdomainInputInvalid"),
      orientation: "larger_is_higher",
      equalityClasses,
      equalityProvenance: nonblankString(target.equalityProvenance, `${field}.equalityProvenance`, "mdomainInputInvalid"),
    });
  }

  const provenance = strictRecord(record.provenance, "input.provenance", "mdomainInputInvalid");
  exactKeys(provenance, PROVENANCE_FIELDS, "input.provenance", "mdomainInputInvalid");
  if (provenance.properLaw !== true) {
    fail("mdomainInputInvalid", "input.provenance.properLaw", "The producer must explicitly declare a proper complete finite law.");
  }
  return {
    inputId, lawId, representation: "exact_finite_law", coupling: "supplied_joint",
    unitIds, domainIds, stateIds, states, masses: masses.map(toExact), targets,
    provenance: {
      producer: nonblankString(provenance.producer, "input.provenance.producer", "mdomainInputInvalid"),
      conditioningInfo: nonblankString(provenance.conditioningInfo, "input.provenance.conditioningInfo", "mdomainInputInvalid"),
      jointGeneration: nonblankString(provenance.jointGeneration, "input.provenance.jointGeneration", "mdomainInputInvalid"),
      finiteSupportOrigin: nonblankString(provenance.finiteSupportOrigin, "input.provenance.finiteSupportOrigin", "mdomainInputInvalid"),
      properLaw: true,
    },
  };
}
